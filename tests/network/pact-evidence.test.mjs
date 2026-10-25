import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { abi } from 'genlayer-js';
import {
  assertCreatedDemonstration,
  assertResolvedDemonstration,
  assertTransactionCalldata,
  conditionHolds,
  DEMONSTRATION_ACCOUNT,
  DEMONSTRATION_ARGS,
  DEMONSTRATION_PACT,
  DEMONSTRATION_SOURCE_URL,
  HISTORICAL_DATASET_NOTE,
  pactMatchesDemonstration,
} from '../../scripts/lib/pact-evidence.mjs';

function createdPact() {
  return {
    id: 'WP-0000000001',
    creator: DEMONSTRATION_ACCOUNT,
    location: {
      name: DEMONSTRATION_PACT.locationName,
      admin1: DEMONSTRATION_PACT.admin1,
      country: DEMONSTRATION_PACT.country,
      countryCode: DEMONSTRATION_PACT.countryCode,
      latitude: DEMONSTRATION_PACT.latitude,
      longitude: DEMONSTRATION_PACT.longitude,
      timezone: DEMONSTRATION_PACT.timezone,
    },
    targetDate: DEMONSTRATION_PACT.targetDate,
    metric: 'rain_sum',
    operator: 'gte',
    unit: 'mm',
    threshold: '10',
    prediction: 'YES',
    status: 'READY_TO_RESOLVE',
    createdAt: '2026-10-25T18:00:00Z',
    readyAt: '2025-06-22T00:00:00Z',
    evidence: {
      observedValue: '',
      unit: '',
      sourceName: '',
      sourceUrl: '',
      datasetNote: '',
      resolvedAt: '',
      resolver: '',
      providerLatitude: '',
      providerLongitude: '',
      providerTimezone: '',
      providerUtcOffsetSeconds: '',
    },
  };
}

function resolvedState(observedValue = '21.8') {
  const condition = conditionHolds(observedValue, '10', 'gte');
  const pact = createdPact();
  pact.status = condition ? 'RESOLVED_YES' : 'RESOLVED_NO';
  pact.evidence = {
    observedValue,
    unit: 'mm',
    sourceName: 'Open-Meteo Historical Weather API',
    sourceUrl: DEMONSTRATION_SOURCE_URL,
    datasetNote: HISTORICAL_DATASET_NOTE,
    resolvedAt: '2026-10-25T18:05:00Z',
    resolver: DEMONSTRATION_ACCOUNT,
    providerLatitude: '6.502636',
    providerLongitude: '3.397651',
    providerTimezone: 'Africa/Lagos',
    providerUtcOffsetSeconds: '3600',
  };
  return {
    pact,
    reputation: {
      finalizedPacts: 1,
      correctPredictions: condition ? 1 : 0,
      currentStreak: condition ? 1 : 0,
    },
    metadata: {
      name: 'WeatherPact',
      version: 1,
      resolutionDelayDays: 7,
      sourceName: 'Open-Meteo Historical Weather API',
      sourceHost: 'https://archive-api.open-meteo.com',
      pactCount: 1,
      activityCount: 2,
    },
    activity: [
      { id: 'EV-0000000002', pactId: pact.id, type: 'RESOLVED', actor: DEMONSTRATION_ACCOUNT },
      { id: 'EV-0000000001', pactId: pact.id, type: 'CREATED', actor: DEMONSTRATION_ACCOUNT },
    ],
  };
}

test('evidence runner imports with the locked SDK and stops at usage without credentials or RPC', () => {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/studionet-pact-evidence.mjs'], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '' },
    timeout: 10_000,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Usage: node scripts\/studionet-pact-evidence\.mjs/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED/);
});

test('an uncertain submission journal locks retries before credentials or RPC', () => {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const evidenceDirectory = mkdtempSync(join(tmpdir(), 'weatherpact-evidence-'));
  try {
    writeFileSync(
      join(evidenceDirectory, 'create.json'),
      JSON.stringify({ status: 'SUBMISSION_UNCERTAIN', transactionHash: null }),
    );
    const result = spawnSync(process.execPath, ['scripts/studionet-pact-evidence.mjs', 'create'], {
      cwd,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        WEATHERPACT_EVIDENCE_DIR: evidenceDirectory,
      },
      timeout: 10_000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /no valid transaction hash; refusing to replace it/);
    assert.doesNotMatch(result.stderr, /Signing preflight|GenLayer RPC error/);
  } finally {
    rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('demonstration calldata preserves all twelve string arguments', () => {
  assert.equal(DEMONSTRATION_ARGS.length, 12);
  assert.ok(DEMONSTRATION_ARGS.every((value) => typeof value === 'string'));
  assert.deepEqual(DEMONSTRATION_ARGS.slice(4, 7), ['6.5244', '3.3792', 'Africa/Lagos']);
  assert.equal(DEMONSTRATION_ARGS[10], '10');
});

test('finalized calldata must decode to the exact method and typed arguments', () => {
  const transactionFor = (method, args) => ({
    data: {
      calldata: {
        raw: Array.from(abi.calldata.encode({ method, args })),
      },
    },
  });
  assert.equal(
    assertTransactionCalldata(
      transactionFor('create_pact', DEMONSTRATION_ARGS),
      'create_pact',
      DEMONSTRATION_ARGS,
    ),
    true,
  );
  assert.equal(
    assertTransactionCalldata(transactionFor('resolve_pact', ['WP-0000000001']), 'resolve_pact', [
      'WP-0000000001',
    ]),
    true,
  );
  const numericArgs = [...DEMONSTRATION_ARGS];
  numericArgs[10] = 10;
  assert.throws(() =>
    assertTransactionCalldata(
      transactionFor('create_pact', numericArgs),
      'create_pact',
      DEMONSTRATION_ARGS,
    ),
  );
  assert.throws(() =>
    assertTransactionCalldata(
      transactionFor('resolve_pact', ['WP-0000000001']),
      'create_pact',
      DEMONSTRATION_ARGS,
    ),
  );
  assert.throws(() => assertTransactionCalldata({ data: {} }, 'create_pact', DEMONSTRATION_ARGS));
});

test('pact matching uses the raw nested contract schema and creator', () => {
  const pact = createdPact();
  assert.equal(pactMatchesDemonstration(pact), true);
  assert.equal(assertCreatedDemonstration(pact), true);
  for (const mutate of [
    (value) => {
      value.location.latitude = 6.5244;
    },
    (value) => {
      value.location.name = 'Ikeja';
    },
    (value) => {
      value.targetDate = '2025-06-16';
    },
    (value) => {
      value.creator = '0x0000000000000000000000000000000000000000';
    },
  ]) {
    const candidate = createdPact();
    mutate(candidate);
    assert.equal(pactMatchesDemonstration(candidate), false);
    assert.throws(() => assertCreatedDemonstration(candidate));
  }
});

test('final YES evidence independently verifies observation, activity, and creator reputation', () => {
  const state = resolvedState('21.8');
  assert.deepEqual(assertResolvedDemonstration(state), {
    conditionHolds: true,
    correctPrediction: true,
  });
});

test('final NO evidence requires zero correct predictions and streak', () => {
  const state = resolvedState('5');
  assert.deepEqual(assertResolvedDemonstration(state), {
    conditionHolds: false,
    correctPrediction: false,
  });
});

test('verification rejects contradictory or incomplete final evidence', () => {
  const cases = [
    (state) => {
      state.pact.status = 'RESOLVED_NO';
    },
    (state) => {
      state.pact.evidence.sourceUrl = 'https://example.com/weather';
    },
    (state) => {
      state.pact.evidence.datasetNote = '';
    },
    (state) => {
      state.pact.evidence.providerUtcOffsetSeconds = '0';
    },
    (state) => {
      state.reputation.finalizedPacts = 0;
    },
    (state) => {
      state.reputation.correctPredictions = 0;
    },
    (state) => {
      state.metadata.activityCount = 1;
    },
    (state) => {
      state.activity = state.activity.slice(1);
    },
    (state) => {
      state.activity[0].actor = '0x0000000000000000000000000000000000000000';
    },
  ];
  for (const mutate of cases) {
    const state = resolvedState();
    mutate(state);
    assert.throws(() => assertResolvedDemonstration(state));
  }
});
