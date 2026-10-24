#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyNetwork } from './verify-network.mjs';

const forwarded = process.argv.slice(2);
if (
  forwarded.some(
    (argument) =>
      argument === '--rpc' ||
      argument.startsWith('--rpc=') ||
      argument === '--contract' ||
      argument.startsWith('--contract='),
  )
) {
  console.error(
    'Deployment stopped: do not override --rpc or --contract. This guard always uses GENLAYER_NODE_RPC_URL and contracts/weatherpact.py.',
  );
  process.exit(1);
}

let qualification;
// This must finish before the CLI can sign or submit anything. contractAddress:
// null intentionally skips any old deployment and validates the current source.
try {
  qualification = await verifyNetwork({ contractAddress: null });
} catch (error) {
  console.error(
    `Deployment stopped before signing: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
console.log(
  `Read-only ${qualification.networkLabel} qualification passed. Selecting the matching pinned CLI profile.`,
);

const cli = fileURLToPath(new URL('../node_modules/genlayer/dist/index.js', import.meta.url));
const selected = spawnSync(process.execPath, [cli, 'network', 'set', qualification.cliAlias], {
  stdio: 'inherit',
  env: process.env,
});
if (selected.error || selected.status !== 0) {
  console.error(
    `Deployment stopped before signing: could not select CLI network ${qualification.cliAlias}.`,
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    cli,
    'deploy',
    '--contract',
    'contracts/weatherpact.py',
    '--rpc',
    qualification.nodeRpcUrl,
    ...forwarded,
  ],
  { stdio: 'inherit', env: process.env },
);
child.on('error', (error) => {
  console.error(`Could not start the GenLayer CLI: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Deployment CLI stopped by ${signal}; no success is claimed.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
