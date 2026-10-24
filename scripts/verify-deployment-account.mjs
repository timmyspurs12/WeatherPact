#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { getAddress } from 'viem';

const network = (process.env.GENLAYER_NETWORK ?? '').trim().toLowerCase();
if (network !== 'studionet') {
  throw new Error('Deployment-account verification requires GENLAYER_NETWORK=studionet.');
}
const expectedValue = process.argv[2] ?? process.env.WEATHERPACT_DEPLOYER_ADDRESS;
if (!expectedValue)
  throw new Error('Pass the expected public deployer address as the first argument.');
const expected = getAddress(expectedValue);
const keystorePath =
  process.env.WEATHERPACT_KEYSTORE_PATH ??
  join(homedir(), '.genlayer', 'keystores', 'weatherpact-deployer.json');
const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
if (
  !keystore ||
  typeof keystore !== 'object' ||
  !(keystore.crypto || keystore.Crypto) ||
  typeof keystore.address !== 'string' ||
  'privateKey' in keystore ||
  'privatekey' in keystore
) {
  throw new Error('The deployment account is not a valid encrypted keystore.');
}
const address = getAddress(
  keystore.address.startsWith('0x') ? keystore.address : `0x${keystore.address}`,
);
if (address.toLowerCase() !== expected.toLowerCase()) {
  throw new Error(
    'Deployment stopped before signing: the encrypted account address does not match.',
  );
}
const endpoint = process.env.GENLAYER_NODE_RPC_URL ?? 'https://studio.genlayer.com/api';
const parsed = new URL(endpoint);
if (
  parsed.protocol !== 'https:' ||
  parsed.username ||
  parsed.password ||
  parsed.search ||
  parsed.hash
) {
  throw new Error('Deployment-account verification requires a public HTTPS Studionet RPC.');
}
const client = createClient({ chain: studionet, endpoint: parsed.toString() });
const [chainId, balance] = await Promise.all([client.getChainId(), client.getBalance({ address })]);
if (chainId !== 61999) throw new Error('Deployment-account RPC returned the wrong chain.');
if (balance <= 0n)
  throw new Error('Deployment stopped before signing: the Studionet account is unfunded.');
console.log(
  JSON.stringify(
    {
      network: 'studionet',
      chainId,
      address,
      balanceWei: balance.toString(),
      funded: true,
      encryptedKeystore: true,
    },
    null,
    2,
  ),
);
