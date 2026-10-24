#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from 'genlayer-js';
import { studionet, testnetBradbury } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import { decodeFunctionResult, encodeFunctionData, getAddress, parseAbi } from 'viem';

export const BRADBURY = Object.freeze({
  key: 'bradbury',
  cliAlias: 'testnet-bradbury',
  label: 'Bradbury Phase 2',
  chainId: 4221,
  chainIdHex: '0x107d',
  genesis: '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4',
  addressManager: '0x3F71AE080BD6270A91dBcc7960d88797828538E0',
  consensusAddress: testnetBradbury.consensusMainContract?.address,
  sdkChain: testnetBradbury,
  defaultNodeRpc: null,
  defaultChainRpc: 'https://rpc.testnet-chain.genlayer.com',
});

export const STUDIONET = Object.freeze({
  key: 'studionet',
  cliAlias: 'studionet',
  label: 'Studionet',
  chainId: 61999,
  chainIdHex: '0xf22f',
  genesis: null,
  addressManager: null,
  consensusAddress: studionet.consensusMainContract?.address,
  sdkChain: studionet,
  defaultNodeRpc: 'https://studio.genlayer.com/api',
  defaultChainRpc: null,
});

const NETWORKS = Object.freeze({ bradbury: BRADBURY, studionet: STUDIONET });
const REQUIRED_METHODS = [
  'create_pact',
  'resolve_pact',
  'get_pact',
  'get_pacts',
  'get_activity',
  'get_reputation',
  'get_metadata',
];
const addressManagerAbi = parseAbi(['function getAddressManager() view returns (address)']);
let requestId = 0;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
  return value;
}

function networkProfile(value) {
  const key = (value ?? 'bradbury').trim().toLowerCase();
  const profile = NETWORKS[key];
  if (!profile) {
    throw new Error(
      `Unsupported GenLayer network "${value}". Choose exactly bradbury or studionet.`,
    );
  }
  if (!profile.consensusAddress) {
    throw new Error(
      `The pinned genlayer-js release lacks ${profile.label} consensus configuration.`,
    );
  }
  return profile;
}

function endpoint(value, label) {
  if (!value) {
    throw new Error(
      `${label} is required. Set GENLAYER_NODE_RPC_URL (or VITE_GENLAYER_RPC_URL) to a qualified GenLayer node; a chain-only RPC is insufficient.`,
    );
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    (parsed.protocol !== 'https:' && !loopback) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${label} must be HTTPS (or loopback HTTP for tests) without URL credentials.`);
  }
  return parsed.toString();
}

async function rpc(url, method, params = []) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`RPC endpoint could not be reached for ${method}.`);
  }
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}.`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${method} returned malformed JSON.`);
  }
  const body = record(payload, method);
  if (body.error) {
    const error = record(body.error, `${method} error`);
    throw new Error(
      `${method} failed: ${typeof error.message === 'string' ? error.message : 'RPC error'}.`,
    );
  }
  return body.result;
}

function assertChainId(value, source, profile) {
  if (
    typeof value !== 'string' ||
    !/^0x[0-9a-fA-F]+$/.test(value) ||
    BigInt(value) !== BigInt(profile.chainId)
  ) {
    throw new Error(
      `${source} chain ID mismatch: expected ${profile.label} chain ${profile.chainId}.`,
    );
  }
}

function assertGenesis(value, source) {
  const block = record(value, `${source} genesis`);
  if (typeof block.hash !== 'string' || block.hash.toLowerCase() !== BRADBURY.genesis) {
    throw new Error(`${source} genesis mismatch. Deployment and writes are stopped.`);
  }
}

function assertDeployedCode(value, source, target) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{2,}$/.test(value)) {
    throw new Error(`${source} has no code at the required ${target}.`);
  }
}

async function assertManagerPointer(url, source, consensusAddress) {
  const data = encodeFunctionData({ abi: addressManagerAbi, functionName: 'getAddressManager' });
  const result = await rpc(url, 'eth_call', [{ to: consensusAddress, data }, 'latest']);
  if (typeof result !== 'string') throw new Error(`${source} AddressManager lookup failed.`);
  const actual = decodeFunctionResult({
    abi: addressManagerAbi,
    functionName: 'getAddressManager',
    data: result,
  });
  if (actual.toLowerCase() !== BRADBURY.addressManager.toLowerCase()) {
    throw new Error(`${source} consensus points to a different AddressManager.`);
  }
}

async function genCall(label, operation) {
  try {
    return await operation();
  } catch {
    throw new Error(`${label} failed on the GenLayer node RPC.`);
  }
}

function assertWeatherPactSchema(value, label) {
  const schema = record(value, label);
  const methods = record(schema.methods, `${label} methods`);
  for (const method of REQUIRED_METHODS) {
    if (!methods[method]) throw new Error(`${label} is missing required method ${method}.`);
  }
}

/**
 * Read-only qualification for an explicitly selected supported network.
 * Bradbury keeps its independent chain/genesis/AddressManager checks. Studionet
 * uses its single official RPC and the pinned Studio consensus deployment.
 * No account, signing, funding, or write is used.
 */
export async function verifyNetwork(options = {}) {
  const profile = networkProfile(
    options.network ?? process.env.GENLAYER_NETWORK ?? process.env.VITE_GENLAYER_NETWORK,
  );
  const nodeUrl = endpoint(
    options.nodeRpcUrl ??
      process.env.GENLAYER_NODE_RPC_URL ??
      process.env.VITE_GENLAYER_RPC_URL ??
      profile.defaultNodeRpc,
    `${profile.label} GenLayer RPC`,
  );
  let chainUrl = null;
  if (profile.key === 'bradbury') {
    chainUrl = endpoint(
      options.chainRpcUrl ??
        process.env.GENLAYER_CHAIN_RPC_URL ??
        process.env.VITE_GENLAYER_CHAIN_RPC_URL ??
        profile.defaultChainRpc,
      'Bradbury chain RPC',
    );
  } else {
    const configuredStudioChain =
      options.chainRpcUrl ??
      process.env.GENLAYER_CHAIN_RPC_URL ??
      process.env.VITE_GENLAYER_CHAIN_RPC_URL;
    if (configuredStudioChain) {
      const studioChainUrl = endpoint(configuredStudioChain, 'Studionet chain RPC');
      if (studioChainUrl !== nodeUrl) {
        throw new Error(
          'Studionet uses one official GenLayer RPC. Remove the separate chain RPC or make it identical; never reuse the Bradbury chain RPC.',
        );
      }
    }
  }

  const configuredAddress =
    options.contractAddress === undefined
      ? (process.env.WEATHERPACT_CONTRACT_ADDRESS ?? process.env.VITE_WEATHERPACT_CONTRACT_ADDRESS)
      : options.contractAddress;
  if (options.requireContract && !configuredAddress) {
    throw new Error('WEATHERPACT_CONTRACT_ADDRESS is required for post-deployment verification.');
  }
  const contractAddress = configuredAddress ? getAddress(configuredAddress) : null;

  if (chainUrl) {
    const [nodeChain, chainChain] = await Promise.all([
      rpc(nodeUrl, 'eth_chainId'),
      rpc(chainUrl, 'eth_chainId'),
    ]);
    assertChainId(nodeChain, 'GenLayer node', profile);
    assertChainId(chainChain, 'Chain RPC', profile);
  } else {
    assertChainId(await rpc(nodeUrl, 'eth_chainId'), 'Studionet RPC', profile);
  }

  if (profile.key === 'bradbury') {
    const [nodeGenesis, chainGenesis] = await Promise.all([
      rpc(nodeUrl, 'eth_getBlockByNumber', ['0x0', false]),
      rpc(chainUrl, 'eth_getBlockByNumber', ['0x0', false]),
    ]);
    assertGenesis(nodeGenesis, 'GenLayer node');
    assertGenesis(chainGenesis, 'Chain RPC');

    const [nodeCode, chainCode] = await Promise.all([
      rpc(nodeUrl, 'eth_getCode', [profile.addressManager, 'latest']),
      rpc(chainUrl, 'eth_getCode', [profile.addressManager, 'latest']),
    ]);
    assertDeployedCode(nodeCode, 'GenLayer node', 'AddressManager');
    assertDeployedCode(chainCode, 'Chain RPC', 'AddressManager');
    await Promise.all([
      assertManagerPointer(nodeUrl, 'GenLayer node', profile.consensusAddress),
      assertManagerPointer(chainUrl, 'Chain RPC', profile.consensusAddress),
    ]);
  }

  // Studio's pinned SDK/CLI consensus configuration is intentionally static.
  // Its RPC does not expose EVM bytecode at that address, so do not copy the
  // Bradbury eth_getCode rule. The actual Studio gen_* source-schema call below
  // is mandatory; chain ID alone can never qualify this profile.
  const client = createClient({ chain: profile.sdkChain, endpoint: nodeUrl });
  const sourcePath = options.sourcePath ?? resolve('contracts/weatherpact.py');
  const source = await readFile(sourcePath, 'utf8');
  assertWeatherPactSchema(
    await genCall('gen_getContractSchema (source)', () => client.getContractSchemaForCode(source)),
    'Source schema',
  );

  if (contractAddress) {
    const code = await genCall('gen_getContractCode', () =>
      client.getContractCode(contractAddress),
    );
    if (!code.trim()) throw new Error('The configured contract has no source code on this node.');
    assertWeatherPactSchema(
      await genCall('gen_getContractSchema (deployed)', () =>
        client.getContractSchema(contractAddress),
      ),
      'Deployed contract schema',
    );
    const metadata = record(
      await genCall('gen_call (get_metadata)', () =>
        client.readContract({
          address: contractAddress,
          functionName: 'get_metadata',
          args: [],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }),
      ),
      'WeatherPact metadata',
    );
    if (metadata.name !== 'WeatherPact' || Number(metadata.version) !== 1) {
      throw new Error('The deployed contract returned unexpected WeatherPact metadata.');
    }
  }

  return {
    network: profile.key,
    cliAlias: profile.cliAlias,
    networkLabel: profile.label,
    nodeRpcUrl: nodeUrl,
    chainId: profile.chainId,
    contractAddress,
    methods: REQUIRED_METHODS.length,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const result = await verifyNetwork({
      requireContract: process.argv.includes('--require-contract'),
    });
    console.log(
      `${result.networkLabel} qualification passed: chain ${result.chainId}, ${result.methods} required methods, ${result.contractAddress ? 'deployed contract and gen_call verified' : 'pre-deploy source schema verified'}.`,
    );
  } catch (error) {
    console.error(
      `Network verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
