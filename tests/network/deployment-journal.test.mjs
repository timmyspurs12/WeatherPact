import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  appendDeploymentOutput,
  assertNoPriorDeployment,
  deploymentHashFromOutput,
  deploymentJournalPath,
  recordFinalizedDeployment,
  recordSubmittedDeployment,
  redactDeploymentOutput,
} from '../../scripts/lib/deployment.mjs';

const hashA = `0x${'a'.repeat(64)}`;
const hashB = `0x${'b'.repeat(64)}`;
const contractAddress = `0x${'1'.repeat(40)}`;
const sourceDigest = 'c'.repeat(64);

function temporaryDirectory() {
  return mkdtempSync(join(tmpdir(), 'weatherpact-deployment-test-'));
}

test('extracts exactly one CLI transaction ID and redacts the keystore password', () => {
  const password = 'correct horse battery staple';
  const output = `\u001b[32mDeployment Transaction Hash:\u001b[0m ${hashA}\n${password}`;
  assert.equal(deploymentHashFromOutput(output), hashA);
  const redacted = redactDeploymentOutput(output, [password]);
  assert.equal(redacted.includes(password), false);
  assert.ok(redacted.includes('[REDACTED]'));
  assert.equal(deploymentHashFromOutput('Deployment Transaction Hash: not-a-hash'), null);
  assert.throws(
    () =>
      deploymentHashFromOutput(
        `Deployment Transaction Hash: ${hashA}\nDeployment Transaction Hash: ${hashB}`,
      ),
    /conflicting deployment transaction IDs/,
  );
});

test('records submission immediately and finalizes only the same transaction', () => {
  const directory = temporaryDirectory();
  try {
    const journalPath = join(directory, 'nested', 'deployment.json');
    const outputPath = join(directory, 'github-output.txt');
    assert.doesNotThrow(() => assertNoPriorDeployment(journalPath));
    const submitted = recordSubmittedDeployment(journalPath, {
      network: 'studionet',
      chainId: 61999,
      nodeRpcUrl: 'https://studio.genlayer.com/api',
      contractSourceSha256: sourceDigest,
      transactionHash: hashA,
    });
    assert.equal(submitted.status, 'SUBMITTED');
    assert.equal(submitted.contractAddress, null);
    assert.equal(statSync(journalPath).mode & 0o777, 0o600);
    assert.throws(() => assertNoPriorDeployment(journalPath), new RegExp(hashA));
    assert.throws(
      () =>
        recordSubmittedDeployment(journalPath, {
          network: 'studionet',
          chainId: 61999,
          transactionHash: hashB,
        }),
      /different deployment transaction/,
    );

    appendDeploymentOutput('transaction_hash', hashA, outputPath);
    const finalized = recordFinalizedDeployment(journalPath, {
      network: 'studionet',
      chainId: 61999,
      nodeRpcUrl: 'https://studio.genlayer.com/api',
      transactionHash: hashA,
      contractAddress,
    });
    assert.equal(finalized.status, 'FINALIZED');
    assert.equal(finalized.executionSuccessful, true);
    assert.equal(finalized.contractAddress, contractAddress);
    assert.equal(finalized.contractSourceSha256, sourceDigest);
    assert.equal(finalized.submittedAt, submitted.submittedAt);
    appendDeploymentOutput('contract_address', contractAddress, outputPath);
    const output = readFileSync(outputPath, 'utf8');
    assert.ok(output.includes(`transaction_hash=${hashA}`));
    assert.ok(output.includes(`contract_address=${contractAddress}`));
    assert.throws(
      () =>
        recordFinalizedDeployment(journalPath, {
          network: 'studionet',
          chainId: 61999,
          transactionHash: hashB,
          contractAddress,
        }),
      /different transaction/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects malformed journals and unsafe repository journal locations', () => {
  const directory = temporaryDirectory();
  try {
    const malformed = join(directory, 'malformed.json');
    writeFileSync(malformed, '{not-json', { mode: 0o600 });
    assert.throws(() => assertNoPriorDeployment(malformed), /JSON|malformed/);
    assert.throws(
      () => deploymentJournalPath('deployment.json', '/home/user/WeatherPact'),
      /outside the repository or under ignored \.secrets/,
    );
    assert.throws(
      () => deploymentJournalPath('', '/home/user/WeatherPact'),
      /outside the repository/,
    );
    assert.throws(
      () => deploymentJournalPath('..data', '/home/user/WeatherPact'),
      /outside the repository/,
    );
    assert.equal(
      deploymentJournalPath('.secrets/deployment.json', '/home/user/WeatherPact'),
      '/home/user/WeatherPact/.secrets/deployment.json',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
