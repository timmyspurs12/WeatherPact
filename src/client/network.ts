import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import { studionet, testnetBradbury } from 'genlayer-js/chains';

export const BRADBURY_CHAIN_ID = 4221;
export const BRADBURY_CHAIN_ID_HEX = '0x107d';
export const BRADBURY_GENESIS =
  '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4';
export const BRADBURY_ADDRESS_MANAGER = '0x3F71AE080BD6270A91dBcc7960d88797828538E0';
export const STUDIONET_CHAIN_ID = 61999;

export const NETWORK_PROFILES = {
  bradbury: {
    key: 'bradbury',
    label: 'GenLayer Bradbury Testnet',
    chainId: BRADBURY_CHAIN_ID,
    genesis: BRADBURY_GENESIS,
    addressManager: BRADBURY_ADDRESS_MANAGER,
    consensusAddress: testnetBradbury.consensusMainContract?.address,
    sdkChain: testnetBradbury,
  },
  studionet: {
    key: 'studionet',
    label: 'GenLayer Studio Network',
    chainId: STUDIONET_CHAIN_ID,
    genesis: null,
    addressManager: null,
    consensusAddress: studionet.consensusMainContract?.address,
    sdkChain: studionet,
  },
} as const;

export type NetworkProfile = (typeof NETWORK_PROFILES)[keyof typeof NETWORK_PROFILES];

const addressManagerAbi = parseAbi(['function getAddressManager() view returns (address)']);
const requiredMethods = [
  'create_pact',
  'resolve_pact',
  'get_pact',
  'get_pacts',
  'get_activity',
  'get_reputation',
  'get_metadata',
] as const;

let requestId = 0;

export function getNetworkProfile(value: string | null | undefined): NetworkProfile | null {
  const key = value?.trim().toLowerCase();
  return key === 'bradbury' || key === 'studionet' ? NETWORK_PROFILES[key] : null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
  return value as Record<string, unknown>;
}

/** JSON-RPC without logging URLs, request payloads, accounts, or credentials. */
export async function nodeRpc(
  endpoint: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`The qualified GenLayer node could not be reached for ${method}.`);
  }
  if (!response.ok) {
    throw new Error(`GenLayer node ${method} returned HTTP ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`GenLayer node ${method} returned malformed JSON.`);
  }
  const body = record(payload, `GenLayer node ${method}`);
  if (body.error) {
    const error = record(body.error, `GenLayer node ${method} error`);
    const message = typeof error.message === 'string' ? error.message : 'RPC method unavailable';
    throw new Error(`GenLayer node ${method} failed: ${message}`);
  }
  return body.result;
}

function assertChainId(actual: unknown, profile: NetworkProfile): void {
  if (
    typeof actual !== 'string' ||
    !/^0x[0-9a-fA-F]+$/.test(actual) ||
    BigInt(actual) !== BigInt(profile.chainId)
  ) {
    throw new Error(
      `Network identity mismatch: expected ${profile.label} chain ${profile.chainId}.`,
    );
  }
}

function assertDeployedCode(actual: unknown, target: string): void {
  if (typeof actual !== 'string' || !/^0x[0-9a-fA-F]{2,}$/.test(actual)) {
    throw new Error(`Network identity mismatch: no deployed code at the required ${target}.`);
  }
}

async function assertBradburyIdentity(endpoint: string): Promise<void> {
  const genesis = record(
    await nodeRpc(endpoint, 'eth_getBlockByNumber', ['0x0', false]),
    'Genesis block lookup',
  );
  if (typeof genesis.hash !== 'string' || genesis.hash.toLowerCase() !== BRADBURY_GENESIS) {
    throw new Error('Network identity mismatch: Bradbury genesis hash does not match.');
  }

  assertDeployedCode(
    await nodeRpc(endpoint, 'eth_getCode', [BRADBURY_ADDRESS_MANAGER, 'latest']),
    'Bradbury AddressManager',
  );

  const consensusAddress = NETWORK_PROFILES.bradbury.consensusAddress;
  if (!consensusAddress) throw new Error('The pinned SDK has no Bradbury consensus address.');
  const managerResult = await nodeRpc(endpoint, 'eth_call', [
    {
      to: consensusAddress,
      data: encodeFunctionData({ abi: addressManagerAbi, functionName: 'getAddressManager' }),
    },
    'latest',
  ]);
  if (typeof managerResult !== 'string') {
    throw new Error('AddressManager lookup returned an unexpected response.');
  }
  const actualManager = decodeFunctionResult({
    abi: addressManagerAbi,
    functionName: 'getAddressManager',
    data: managerResult as `0x${string}`,
  });
  if (actualManager.toLowerCase() !== BRADBURY_ADDRESS_MANAGER.toLowerCase()) {
    throw new Error('Network identity mismatch: consensus reports a different AddressManager.');
  }
}

/**
 * Stops on every identity or capability mismatch. Studionet deliberately uses
 * its pinned Studio consensus deployment rather than Bradbury-only genesis and
 * AddressManager checks. Every profile still requires real gen_* methods.
 */
export async function verifyNetworkProfile(
  profile: NetworkProfile,
  endpoint: string,
  contractAddress: string,
): Promise<void> {
  assertChainId(await nodeRpc(endpoint, 'eth_chainId'), profile);
  const consensusAddress = profile.consensusAddress;
  if (!consensusAddress) {
    throw new Error(`The pinned SDK has no ${profile.label} consensus address.`);
  }

  if (profile.key === 'bradbury') {
    await assertBradburyIdentity(endpoint);
  } else {
    assertDeployedCode(
      await nodeRpc(endpoint, 'eth_getCode', [consensusAddress, 'latest']),
      'Studionet consensus deployment',
    );
  }

  const contractCode = await nodeRpc(endpoint, 'gen_getContractCode', [
    { address: contractAddress },
  ]);
  if (typeof contractCode !== 'string' || !contractCode) {
    throw new Error('The configured WeatherPact contract code is unavailable on this node.');
  }
  const schema = record(
    await nodeRpc(endpoint, 'gen_getContractSchema', [{ code: contractCode }]),
    'WeatherPact schema lookup',
  );
  const methods = record(schema.methods, 'WeatherPact schema');
  for (const method of requiredMethods) {
    if (!methods[method]) {
      throw new Error(`Configured contract is not WeatherPact-compatible: missing ${method}.`);
    }
  }
}

/** Backward-compatible strict Bradbury entry point. */
export async function verifyBradburyNode(endpoint: string, contractAddress: string): Promise<void> {
  return verifyNetworkProfile(NETWORK_PROFILES.bradbury, endpoint, contractAddress);
}
