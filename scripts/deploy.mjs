#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyNetwork } from './verify-network.mjs';
import {
  appendDeploymentOutput,
  assertNoPriorDeployment,
  deploymentHashFromOutput,
  deploymentJournalPath,
  recordSubmittedDeployment,
  redactDeploymentOutput,
} from './lib/deployment.mjs';

const forwarded = process.argv.slice(2);
if (
  forwarded.some((argument) =>
    ['--rpc', '--contract', '--fees', '--fee-value', '--password', '--source-password'].some(
      (option) => argument === option || argument.startsWith(`${option}=`),
    ),
  )
) {
  console.error(
    'Deployment stopped: RPC, contract, and manual fee overrides are not accepted. The guard uses the qualified RPC, contracts/weatherpact.py, and the stable CLI fee path.',
  );
  process.exit(1);
}

const journalPath = deploymentJournalPath(process.env.WEATHERPACT_DEPLOYMENT_JOURNAL);
const rawPassword = process.env.WEATHERPACT_KEYSTORE_PASSWORD;
const password = rawPassword ? rawPassword.replace(/[\r\n]+$/, '') : '';
if (rawPassword && (!password || /[\r\n]/.test(password))) {
  console.error(
    'Deployment stopped before signing: the keystore password must be one non-empty line.',
  );
  process.exit(1);
}
if (process.env.GITHUB_ACTIONS === 'true' && !password) {
  console.error(
    'Deployment stopped before signing: WEATHERPACT_KEYSTORE_PASSWORD is required in GitHub Actions.',
  );
  process.exit(1);
}

try {
  assertNoPriorDeployment(journalPath);
} catch (error) {
  console.error(`Deployment stopped before signing: ${error.message}`);
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
const contractSourceSha256 = createHash('sha256')
  .update(readFileSync('contracts/weatherpact.py'))
  .digest('hex');

const cli = fileURLToPath(new URL('../node_modules/genlayer/dist/index.js', import.meta.url));
const childEnv = { ...process.env };
delete childEnv.WEATHERPACT_KEYSTORE_PASSWORD;
delete childEnv.WEATHERPACT_STUDIONET_KEYSTORE;
const selected = spawnSync(process.execPath, [cli, 'network', 'set', qualification.cliAlias], {
  stdio: 'inherit',
  env: childEnv,
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
  {
    stdio: [password ? 'pipe' : 'inherit', 'pipe', 'pipe'],
    env: childEnv,
  },
);

let output = '';
let recordedHash = null;
let captureError = null;
let spawnError = null;

function notice(message) {
  console.log(process.env.GITHUB_ACTIONS === 'true' ? `::notice::${message}` : message);
}

function consume(chunk, destination) {
  const text = redactDeploymentOutput(chunk.toString(), [password]);
  destination.write(text);
  output = `${output}${text}`.slice(-512_000);
  if (captureError) return;
  try {
    const hash = deploymentHashFromOutput(output);
    if (hash && !recordedHash) {
      recordSubmittedDeployment(journalPath, {
        network: qualification.network,
        chainId: qualification.chainId,
        nodeRpcUrl: qualification.nodeRpcUrl,
        contractSourceSha256,
        transactionHash: hash,
      });
      recordedHash = hash;
      appendDeploymentOutput('transaction_hash', hash);
      appendDeploymentOutput('deployment_journal', journalPath);
      notice(
        `Deployment transaction ${hash} was recorded. Resume this same ID; no replacement will be submitted.`,
      );
    }
  } catch (error) {
    captureError = error;
    console.error(
      `Deployment recording stopped: ${redactDeploymentOutput(error.message, [password])}`,
    );
    child.kill('SIGTERM');
  }
}

child.stdout.on('data', (chunk) => consume(chunk, process.stdout));
child.stderr.on('data', (chunk) => consume(chunk, process.stderr));
child.on('error', (error) => {
  spawnError = error;
});
if (password) {
  child.stdin.on('error', () => {});
  child.stdin.end(`${password}\n`);
}

child.on('close', (code, signal) => {
  if (captureError) {
    process.exitCode = 1;
    return;
  }
  if (recordedHash) {
    if (spawnError || code !== 0 || signal) {
      console.error(
        `The CLI ended uncertainly after submission (${spawnError?.message ?? signal ?? `exit ${code}`}). Transaction ${recordedHash} is preserved; resume it rather than deploying again.`,
      );
    } else {
      console.log(
        `Deployment transaction ${recordedHash} is recorded. Finalization and execution verification are still required.`,
      );
    }
    appendDeploymentOutput('resume_allowed', 'true');
    process.exitCode = 0;
    return;
  }
  console.error(
    `Deployment did not return a transaction ID (${spawnError?.message ?? signal ?? `exit ${code}`}). No deployment success is claimed.`,
  );
  process.exitCode = 1;
});
