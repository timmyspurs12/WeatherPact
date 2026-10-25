import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const DEPLOYMENT_HASH = /^0x[0-9a-fA-F]{64}$/;
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export function redactDeploymentOutput(value, secrets = []) {
  let text = String(value);
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) {
      text = text.split(secret).join('[REDACTED]');
    }
  }
  return text;
}

export function deploymentHashFromOutput(value) {
  const clean = String(value).replace(ANSI, '');
  const matches = [
    ...clean.matchAll(/Deployment Transaction Hash\s*:\s*["']?(0x[0-9a-fA-F]{64})["']?/g),
  ];
  const hashes = [...new Set(matches.map((match) => match[1]))];
  if (hashes.length > 1) {
    throw new Error(
      'The CLI reported conflicting deployment transaction IDs. Stop and reconcile manually.',
    );
  }
  return hashes[0] ?? null;
}

export function inspectDeploymentReceipt(receipt, network) {
  const status =
    receipt?.statusName ?? receipt?.status_name ?? String(receipt?.status ?? 'unknown');
  let execution = receipt?.txExecutionResultName ?? String(receipt?.txExecutionResult ?? 'unknown');
  let resultCode;
  let executionSuccessful = execution === 'FINISHED_WITH_RETURN';

  // genlayer-js 1.1.8 simplified Studionet receipts rename statusName to
  // status_name and preserve GenVM execution under the leader receipt. Never
  // override an explicit top-level execution result with this fallback.
  if (
    network === 'studionet' &&
    receipt?.txExecutionResultName === undefined &&
    receipt?.txExecutionResult === undefined
  ) {
    const leaderReceipts = receipt?.consensus_data?.leader_receipt;
    if (Array.isArray(leaderReceipts) && leaderReceipts.length === 1) {
      const leader = leaderReceipts[0];
      execution = leader?.execution_result ?? execution;
      resultCode = leader?.result?.status;
      executionSuccessful = execution === 'SUCCESS' && resultCode === 'return';
    } else {
      executionSuccessful = false;
    }
  }

  return {
    status,
    execution,
    resultCode,
    finalized: status === 'FINALIZED',
    executionSuccessful,
  };
}

export function deploymentJournalPath(value, cwd = process.cwd()) {
  const root = resolve(cwd);
  const path = resolve(root, value ?? '.secrets/weatherpact-deployment.json');
  const rel = relative(root, path);
  const outsideRepository = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (!outsideRepository && !rel.startsWith('.secrets/')) {
    throw new Error(
      'Deployment journals must be outside the repository or under ignored .secrets/.',
    );
  }
  return path;
}

function readJournal(path) {
  if (!existsSync(path)) return null;
  const record = JSON.parse(readFileSync(path, 'utf8'));
  if (!record || typeof record !== 'object' || !DEPLOYMENT_HASH.test(record.transactionHash)) {
    throw new Error('The existing deployment journal is malformed. Stop and reconcile manually.');
  }
  return record;
}

function writeJournal(path, record) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function assertNoPriorDeployment(path) {
  const existing = readJournal(path);
  if (existing) {
    throw new Error(
      `A deployment journal already exists for ${existing.transactionHash}. Resume that transaction; no replacement was submitted.`,
    );
  }
}

export function appendDeploymentOutput(name, value, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /[\r\n]/.test(String(value))) {
    throw new Error('Invalid GitHub step output.');
  }
  appendFileSync(outputPath, `${name}=${String(value)}\n`, { mode: 0o600 });
}

export function recordSubmittedDeployment(path, record) {
  if (!DEPLOYMENT_HASH.test(record.transactionHash)) {
    throw new Error('Cannot journal an invalid deployment transaction ID.');
  }
  const existing = readJournal(path);
  if (existing && existing.transactionHash !== record.transactionHash) {
    throw new Error('Refusing to replace a different deployment transaction in the journal.');
  }
  const journal = {
    schemaVersion: 1,
    status: 'SUBMITTED',
    network: record.network,
    chainId: record.chainId,
    nodeRpcUrl: record.nodeRpcUrl,
    contractSourceSha256: record.contractSourceSha256,
    transactionHash: record.transactionHash,
    contractAddress: null,
    submittedAt: existing?.submittedAt ?? new Date().toISOString(),
  };
  writeJournal(path, journal);
  return journal;
}

export function recordFinalizedDeployment(path, record) {
  if (!DEPLOYMENT_HASH.test(record.transactionHash)) {
    throw new Error('Cannot journal an invalid deployment transaction ID.');
  }
  const existing = readJournal(path);
  if (existing && existing.transactionHash !== record.transactionHash) {
    throw new Error('Refusing to finalize a different transaction in the deployment journal.');
  }
  const journal = {
    schemaVersion: 1,
    ...existing,
    status: 'FINALIZED',
    network: record.network,
    chainId: record.chainId,
    nodeRpcUrl: record.nodeRpcUrl ?? existing?.nodeRpcUrl ?? null,
    contractSourceSha256: record.contractSourceSha256 ?? existing?.contractSourceSha256 ?? null,
    transactionHash: record.transactionHash,
    contractAddress: record.contractAddress,
    executionSuccessful: true,
    finalizedAt: new Date().toISOString(),
  };
  writeJournal(path, journal);
  return journal;
}
