#!/usr/bin/env node
import { createClient } from 'genlayer-js';
import { studionet, testnetBradbury } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';
import { getAddress } from 'viem';
import {
  appendDeploymentOutput,
  deploymentJournalPath,
  inspectDeploymentReceipt,
  recordFinalizedDeployment,
} from './lib/deployment.mjs';

const profiles = {
  studionet: {
    chainId: 61999,
    sdkChain: studionet,
    defaultRpc: 'https://studio.genlayer.com/api',
  },
  bradbury: {
    chainId: 4221,
    sdkChain: testnetBradbury,
    defaultRpc: null,
  },
};

function selectedProfile() {
  const key = (process.env.GENLAYER_NETWORK ?? process.env.VITE_GENLAYER_NETWORK ?? 'bradbury')
    .trim()
    .toLowerCase();
  const profile = profiles[key];
  if (!profile) throw new Error('Choose exactly GENLAYER_NETWORK=studionet or bradbury.');
  return { key, ...profile };
}

function publicEndpoint(value) {
  if (!value) throw new Error('A qualified GenLayer RPC is required for deployment tracking.');
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Deployment tracking requires an HTTPS RPC without credentials or query data.');
  }
  return parsed.toString();
}

const hash = process.argv[2] ?? process.env.WEATHERPACT_DEPLOYMENT_TX;
if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  throw new Error('Pass the existing deployment transaction ID as the first argument.');
}

const profile = selectedProfile();
const endpoint = publicEndpoint(
  process.env.GENLAYER_NODE_RPC_URL ?? process.env.VITE_GENLAYER_RPC_URL ?? profile.defaultRpc,
);
const client = createClient({ chain: profile.sdkChain, endpoint });
const actualChainId = await client.getChainId();
if (actualChainId !== profile.chainId) {
  throw new Error(`Tracking stopped: expected ${profile.key} chain ${profile.chainId}.`);
}

// This function only waits and reads. If interrupted, rerun with the same hash;
// it has no deployment or write capability.
const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
  interval: 5_000,
  retries: 120,
});
const receiptStatus = inspectDeploymentReceipt(receipt, profile.key);
if (!receiptStatus.finalized || !receiptStatus.executionSuccessful) {
  const result = receiptStatus.resultCode ? `, result ${receiptStatus.resultCode}` : '';
  throw new Error(
    `Deployment ${hash} did not reach finalized successful execution (status ${receiptStatus.status}, execution ${receiptStatus.execution}${result}).`,
  );
}
// Re-read the full finalized transaction only to recover the deployed address;
// the simplified receipt above has already proven finality and VM execution.
const transaction = await client.getTransaction({ hash });
const rawAddress = transaction.data?.contract_address ?? transaction.txDataDecoded?.contractAddress;
if (!rawAddress) {
  throw new Error(`Deployment ${hash} finalized successfully but returned no contract address.`);
}
const contractAddress = getAddress(rawAddress);
const journalPath = deploymentJournalPath(process.env.WEATHERPACT_DEPLOYMENT_JOURNAL);
recordFinalizedDeployment(journalPath, {
  network: profile.key,
  chainId: profile.chainId,
  nodeRpcUrl: endpoint,
  contractSourceSha256: process.env.WEATHERPACT_CONTRACT_SOURCE_SHA256 || null,
  transactionHash: hash,
  contractAddress,
});
appendDeploymentOutput('transaction_hash', hash);
appendDeploymentOutput('contract_address', contractAddress);
appendDeploymentOutput('deployment_journal', journalPath);
console.log(
  JSON.stringify(
    {
      network: profile.key,
      chainId: profile.chainId,
      transactionHash: hash,
      contractAddress,
      finalized: true,
      executionSuccessful: true,
    },
    null,
    2,
  ),
);
