import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { ethers } from 'ethers';
import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant, TransactionStatus } from 'genlayer-js/types';
import { getAddress } from 'viem';
import { inspectDeploymentReceipt } from './lib/deployment.mjs';
import {
  assertCreatedDemonstration,
  assertCurrentYearCreation,
  assertResolvedDemonstration,
  assertTransactionCalldata,
  CURRENT_YEAR_ARGS,
  CURRENT_YEAR_PACT,
  CURRENT_YEAR_PACT_ID,
  DEMONSTRATION_ACCOUNT,
  DEMONSTRATION_ARGS,
  DEMONSTRATION_CONTRACT,
  DEMONSTRATION_PACT,
  DEMONSTRATION_SOURCE_SHA256,
  encryptedKeystoreAddress,
  pactMatchesCurrentYear,
  pactMatchesDemonstration,
} from './lib/pact-evidence.mjs';

const RPC_URL = 'https://studio.genlayer.com/api';
const CHAIN_ID = 61999;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const PACT_ID = /^WP-\d{10}$/;
const contractAddress = getAddress(DEMONSTRATION_CONTRACT);
const accountAddress = getAddress(DEMONSTRATION_ACCOUNT);
const evidenceDirectory = resolve(
  process.env.WEATHERPACT_EVIDENCE_DIR || '.secrets/studionet-pact-evidence',
);
const command = process.argv[2];
const pactIdArgument = process.argv[3];

process.env.GENLAYER_NETWORK = 'studionet';
process.env.GENLAYER_NODE_RPC_URL = RPC_URL;
delete process.env.GENLAYER_CONSENSUS_CONTRACT_ADDRESS;
delete process.env.GENLAYER_CONSENSUS_CONTRACT;

const readClient = createClient({ chain: studionet, endpoint: RPC_URL });

function fail(message) {
  throw new Error(message);
}

function packageVersion(name) {
  return JSON.parse(
    readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'),
  ).version;
}

function assertStableTooling() {
  const expected = { genlayer: '0.39.2', 'genlayer-js': '1.1.8', ethers: '6.17.0' };
  for (const [name, version] of Object.entries(expected)) {
    if (packageVersion(name) !== version)
      fail(`Expected ${name} ${version}; run npm ci without upgrading dependencies.`);
  }
}

async function read(functionName, args = []) {
  return readClient.readContract({
    address: contractAddress,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

async function page(functionName) {
  const result = await read(functionName, [0, 50]);
  if (!result || !Array.isArray(result.items) || result.hasMore) {
    fail(`${functionName} did not return one complete bounded page.`);
  }
  return result.items;
}

function journalPath(kind, pactId = '') {
  return join(evidenceDirectory, `${kind}${pactId ? `-${pactId}` : ''}.json`);
}

function loadJournal(path) {
  if (!existsSync(path)) return null;
  const journal = JSON.parse(readFileSync(path, 'utf8'));
  if (!HASH.test(journal.transactionHash || '')) {
    fail(`Evidence journal ${path} has no valid transaction hash; refusing to replace it.`);
  }
  if (journal.contractAddress && getAddress(journal.contractAddress) !== contractAddress) {
    fail('Evidence journal belongs to a different contract.');
  }
  if (journal.accountAddress && getAddress(journal.accountAddress) !== accountAddress) {
    fail('Evidence journal belongs to a different account.');
  }
  return journal;
}

function saveJson(path, value) {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function canonicalSource() {
  return execFileSync('git', ['show', 'HEAD:contracts/weatherpact.py'], { encoding: 'utf8' });
}

async function qualifyDeployment() {
  assertStableTooling();
  if (Number(await readClient.getChainId()) !== CHAIN_ID)
    fail('The configured endpoint is not Studionet chain 61999.');
  const source = canonicalSource();
  const digest = createHash('sha256').update(source, 'utf8').digest('hex');
  if (digest !== DEMONSTRATION_SOURCE_SHA256)
    fail('Canonical contract source digest changed; refusing to continue.');
  const code = await readClient.getContractCode(contractAddress);
  if (code !== source)
    fail('Deployed code no longer exactly matches the verified contract source.');
  const { verifyNetwork } = await import('./verify-network.mjs');
  await verifyNetwork({ contractAddress });
}

function readEncryptedAccount() {
  const keystorePath = resolve(
    process.env.WEATHERPACT_KEYSTORE_PATH ||
      join(homedir(), '.genlayer', 'keystores', 'weatherpact-deployer-v2.json'),
  );
  const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
  const address = encryptedKeystoreAddress(keystore);
  if (getAddress(address) !== accountAddress) {
    fail('The encrypted keystore does not belong to the expected demonstration account.');
  }
  return { keystore, keystorePath };
}

async function signingClient() {
  const { keystore } = readEncryptedAccount();
  const balance = await readClient.getBalance({ address: accountAddress });
  if (balance <= 0n) fail('The demonstration account has no GEN for transaction fees.');
  let password = process.env.WEATHERPACT_KEYSTORE_PASSWORD;
  if (
    typeof password !== 'string' ||
    password.length === 0 ||
    password.includes('\n') ||
    password.includes('\r')
  ) {
    fail(
      'WEATHERPACT_KEYSTORE_PASSWORD must be a nonempty single-line value; no write was attempted.',
    );
  }
  let wallet;
  try {
    wallet = await ethers.Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
  } finally {
    password = '';
    delete process.env.WEATHERPACT_KEYSTORE_PASSWORD;
  }
  if (getAddress(wallet.address) !== accountAddress)
    fail('Decrypted account does not match the expected address.');
  const account = createAccount(wallet.privateKey);
  if (getAddress(account.address) !== accountAddress) fail('Signing account address mismatch.');
  console.log(`Signing preflight passed for ${accountAddress}; balance ${balance.toString()} wei.`);
  return createClient({ chain: studionet, endpoint: RPC_URL, account });
}

async function waitFinalized(hash, method, expectedArgs) {
  if (!HASH.test(hash)) fail('A valid transaction hash is required.');
  const receipt = await readClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5000,
    fullTransaction: true,
  });
  inspectDeploymentReceipt(receipt, 'studionet');
  assertTransactionCalldata(receipt, method, expectedArgs);
  const returnedHash = receipt.hash || receipt.tx_id || receipt.txId;
  if (returnedHash && returnedHash.toLowerCase() !== hash.toLowerCase())
    fail('Returned transaction identity mismatch.');
  const target = receipt.to_address || receipt.to || receipt.recipient;
  if (target && getAddress(target) !== contractAddress)
    fail('Transaction was not sent to the WeatherPact contract.');
  const sender = receipt.from_address || receipt.from || receipt.sender;
  if (sender && getAddress(sender) !== accountAddress)
    fail('Transaction sender is not the demonstration account.');
  return receipt;
}

async function currentState(pactId) {
  const [pact, metadata, activity, reputation] = await Promise.all([
    read('get_pact', [pactId]),
    read('get_metadata'),
    page('get_activity'),
    read('get_reputation', [accountAddress]),
  ]);
  if (!pact || !pact.id) fail(`Pact ${pactId} does not exist.`);
  return { pact, metadata, activity, reputation };
}

function publicEvidence(kind, transactionHash, state) {
  return {
    network: 'Studionet',
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    contractAddress,
    accountAddress,
    kind,
    transactionHash,
    pact: state.pact,
    metadata: state.metadata,
    activity: state.activity,
    creatorReputation: state.reputation,
  };
}

async function createPact() {
  const path = journalPath('create');
  let journal = loadJournal(path);
  if (
    journal &&
    (journal.kind !== 'create' ||
      !journal.input ||
      Object.keys(journal.input).length !== Object.keys(DEMONSTRATION_PACT).length ||
      !Object.entries(DEMONSTRATION_PACT).every(([key, value]) => journal.input[key] === value))
  ) {
    fail('Create journal does not match the authorized demonstration input.');
  }
  if (!journal) {
    await qualifyDeployment();
    const [metadata, pacts, reputation] = await Promise.all([
      read('get_metadata'),
      page('get_pacts'),
      read('get_reputation', [accountAddress]),
    ]);
    const duplicate = pacts.find((pact) => pactMatchesDemonstration(pact));
    if (duplicate)
      fail(`Matching pact already exists as ${duplicate.id}; refusing to create a replacement.`);
    if (
      Number(metadata.pactCount) !== 0 ||
      Number(metadata.activityCount) !== 0 ||
      pacts.length !== 0
    ) {
      fail('Demonstration requires the verified empty contract; no write was attempted.');
    }
    if (Number(reputation.finalizedPacts) !== 0)
      fail('Demonstration creator reputation is not initially zero.');

    const client = await signingClient();
    const submission = {
      version: 1,
      kind: 'create',
      contractAddress,
      accountAddress,
      input: DEMONSTRATION_PACT,
      attemptedAt: new Date().toISOString(),
    };
    let transactionHash;
    try {
      transactionHash = await client.writeContract({
        account: client.account,
        address: contractAddress,
        functionName: 'create_pact',
        args: [...DEMONSTRATION_ARGS],
        value: 0n,
        leaderOnly: false,
      });
    } catch (error) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        `Create write did not return a hash; retries are locked at ${path}. Reconcile the account and public transaction history before any manual recovery. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!HASH.test(transactionHash)) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        'Create write returned an invalid hash; retries are locked pending manual reconciliation.',
      );
    }
    journal = {
      ...submission,
      status: 'SUBMITTED',
      transactionHash,
      submittedAt: new Date().toISOString(),
    };
    console.log(`Create Transaction Hash: ${transactionHash}`);
    saveJson(path, journal);
    console.log(`Same-hash journal: ${path}`);
  } else {
    console.log(
      `Resuming recorded create transaction ${journal.transactionHash}; no replacement will be submitted.`,
    );
    await qualifyDeployment();
  }

  await waitFinalized(journal.transactionHash, 'create_pact', DEMONSTRATION_ARGS);
  const pacts = await page('get_pacts');
  const matches = pacts.filter((pact) => pactMatchesDemonstration(pact));
  if (matches.length !== 1)
    fail(`Expected exactly one matching stored pact, found ${matches.length}.`);
  assertCreatedDemonstration(matches[0]);
  const state = await currentState(matches[0].id);
  if (Number(state.metadata.pactCount) !== 1 || Number(state.metadata.activityCount) !== 1) {
    fail('Final creation state must contain exactly one pact and one activity.');
  }
  journal = {
    ...journal,
    status: 'FINALIZED',
    pactId: matches[0].id,
    finalizedAt: new Date().toISOString(),
  };
  saveJson(path, journal);
  const evidence = publicEvidence('create', journal.transactionHash, state);
  saveJson(journalPath('create-evidence', matches[0].id), evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

async function createCurrentYearPact() {
  const path = journalPath('create-2026');
  let journal = loadJournal(path);
  if (
    journal &&
    (journal.kind !== 'create-2026' ||
      (journal.pactId && journal.pactId !== CURRENT_YEAR_PACT_ID) ||
      !journal.input ||
      Object.keys(journal.input).length !== Object.keys(CURRENT_YEAR_PACT).length ||
      !Object.entries(CURRENT_YEAR_PACT).every(([key, value]) => journal.input[key] === value))
  ) {
    fail('2026 create journal does not match the authorized current-year pact.');
  }

  if (!journal) {
    await qualifyDeployment();
    const [previousState, pacts] = await Promise.all([
      currentState('WP-0000000001'),
      page('get_pacts'),
    ]);
    const duplicate = pacts.find((pact) => pactMatchesCurrentYear(pact));
    if (duplicate) {
      fail(`Matching 2026 pact already exists as ${duplicate.id}; refusing a replacement.`);
    }
    assertResolvedDemonstration(previousState);
    if (pacts.length !== 1) {
      fail('2026 creation requires exactly the original resolved demonstration pact.');
    }

    const client = await signingClient();
    const submission = {
      version: 1,
      kind: 'create-2026',
      contractAddress,
      accountAddress,
      input: CURRENT_YEAR_PACT,
      attemptedAt: new Date().toISOString(),
    };
    let transactionHash;
    try {
      transactionHash = await client.writeContract({
        account: client.account,
        address: contractAddress,
        functionName: 'create_pact',
        args: [...CURRENT_YEAR_ARGS],
        value: 0n,
        leaderOnly: false,
      });
    } catch (error) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        `2026 create write did not return a hash; retries are locked at ${path}. Reconcile the account and public transaction history before any manual recovery. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!HASH.test(transactionHash)) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        '2026 create write returned an invalid hash; retries are locked pending manual reconciliation.',
      );
    }
    journal = {
      ...submission,
      status: 'SUBMITTED',
      transactionHash,
      submittedAt: new Date().toISOString(),
    };
    console.log(`Create 2026 Transaction Hash: ${transactionHash}`);
    saveJson(path, journal);
    console.log(`Same-hash journal: ${path}`);
  } else {
    console.log(
      `Resuming recorded 2026 create transaction ${journal.transactionHash}; no replacement will be submitted.`,
    );
    await qualifyDeployment();
  }

  await waitFinalized(journal.transactionHash, 'create_pact', CURRENT_YEAR_ARGS);
  const pacts = await page('get_pacts');
  const matches = pacts.filter((pact) => pactMatchesCurrentYear(pact));
  if (matches.length !== 1) {
    fail(`Expected exactly one matching 2026 pact, found ${matches.length}.`);
  }
  const state = await currentState(matches[0].id);
  assertCurrentYearCreation(state);
  const historicalState = await currentState('WP-0000000001');
  assertResolvedDemonstration(historicalState, accountAddress, {
    pactCount: 2,
    activityCount: 3,
  });
  journal = {
    ...journal,
    status: 'FINALIZED',
    pactId: CURRENT_YEAR_PACT_ID,
    finalizedAt: new Date().toISOString(),
  };
  saveJson(path, journal);
  const evidence = publicEvidence('create-2026', journal.transactionHash, state);
  saveJson(journalPath('create-2026-evidence', CURRENT_YEAR_PACT_ID), evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

async function resolvePact(pactId) {
  if (!PACT_ID.test(pactId || '')) fail('Usage: resolve WP-0000000001');
  const path = journalPath('resolve', pactId);
  let journal = loadJournal(path);
  if (journal && (journal.kind !== 'resolve' || journal.pactId !== pactId)) {
    fail('Resolution journal belongs to another operation or pact.');
  }

  await qualifyDeployment();
  let state = await currentState(pactId);
  assertCreatedDemonstration(state.pact);
  if (!journal && ['RESOLVED_YES', 'RESOLVED_NO'].includes(state.pact.status)) {
    console.log('Pact is already resolved; no resolution transaction will be submitted.');
    assertResolvedDemonstration(state);
    console.log(JSON.stringify(publicEvidence('resolve-existing', null, state), null, 2));
    return;
  }

  if (!journal) {
    if (!['OPEN', 'READY_TO_RESOLVE'].includes(state.pact.status))
      fail(`Pact is not resolvable: ${state.pact.status}.`);
    if (Date.now() < Date.parse(state.pact.readyAt))
      fail(`Resolution is not eligible until ${state.pact.readyAt}.`);
    if (Number(state.metadata.pactCount) !== 1 || Number(state.metadata.activityCount) !== 1) {
      fail('Resolution preflight requires exactly one existing pact and creation activity.');
    }
    if (Object.values(state.reputation).some((value) => Number(value) !== 0)) {
      fail('Resolution demonstration requires initially zero creator reputation.');
    }
    const client = await signingClient();
    const submission = {
      version: 1,
      kind: 'resolve',
      contractAddress,
      accountAddress,
      pactId,
      beforeReputation: state.reputation,
      attemptedAt: new Date().toISOString(),
    };
    let transactionHash;
    try {
      transactionHash = await client.writeContract({
        account: client.account,
        address: contractAddress,
        functionName: 'resolve_pact',
        args: [pactId],
        value: 0n,
        leaderOnly: false,
      });
    } catch (error) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        `Resolve write did not return a hash; retries are locked at ${path}. Reconcile the account and public transaction history before any manual recovery. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!HASH.test(transactionHash)) {
      saveJson(path, { ...submission, status: 'SUBMISSION_UNCERTAIN', transactionHash: null });
      fail(
        'Resolve write returned an invalid hash; retries are locked pending manual reconciliation.',
      );
    }
    journal = {
      ...submission,
      status: 'SUBMITTED',
      transactionHash,
      submittedAt: new Date().toISOString(),
    };
    console.log(`Resolve Transaction Hash: ${transactionHash}`);
    saveJson(path, journal);
    console.log(`Same-hash journal: ${path}`);
  } else {
    console.log(
      `Resuming recorded resolve transaction ${journal.transactionHash}; no replacement will be submitted.`,
    );
  }

  await waitFinalized(journal.transactionHash, 'resolve_pact', [pactId]);
  state = await currentState(pactId);
  assertResolvedDemonstration(state);
  journal = { ...journal, status: 'FINALIZED', finalizedAt: new Date().toISOString() };
  saveJson(path, journal);
  const createJournal = loadJournal(journalPath('create'));
  const evidence = {
    ...publicEvidence('resolve', journal.transactionHash, state),
    creationTransactionHash:
      createJournal?.pactId === pactId ? createJournal.transactionHash : null,
  };
  saveJson(journalPath('resolve-evidence', pactId), evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

async function showPact(pactId) {
  if (!PACT_ID.test(pactId || '')) fail('Usage: show WP-0000000001');
  await qualifyDeployment();
  const state = await currentState(pactId);
  assertCreatedDemonstration(state.pact);
  if (['RESOLVED_YES', 'RESOLVED_NO'].includes(state.pact.status))
    assertResolvedDemonstration(state);
  console.log(JSON.stringify(publicEvidence('read-only', null, state), null, 2));
}

try {
  if (command === 'create') await createPact();
  else if (command === 'create-2026') await createCurrentYearPact();
  else if (command === 'resolve') await resolvePact(pactIdArgument);
  else if (command === 'show') await showPact(pactIdArgument);
  else
    fail(
      'Usage: node scripts/studionet-pact-evidence.mjs <create|create-2026|resolve WP-...|show WP-...>',
    );
} catch (error) {
  console.error(
    `Evidence runner stopped: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
