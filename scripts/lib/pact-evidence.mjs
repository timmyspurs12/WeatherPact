import { abi } from 'genlayer-js';

export const DEMONSTRATION_CONTRACT = '0x9417504a58C807E30bdbcb257a3a7B3EbB00FeAE';
export const DEMONSTRATION_ACCOUNT = '0xd70e488a50afbe209f82730ee8c14826112ad354';
export const DEMONSTRATION_SOURCE_SHA256 =
  'f4e3ad9a0ae87c7c7654c6a070f9d395389c1a63d93d61725cac148e78b0b1a0';

export const DEMONSTRATION_PACT = Object.freeze({
  locationName: 'Lagos',
  admin1: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
  latitude: '6.5244',
  longitude: '3.3792',
  timezone: 'Africa/Lagos',
  targetDate: '2025-06-15',
  metric: 'rain_sum',
  operator: 'gte',
  threshold: '10',
  prediction: 'YES',
});

export const DEMONSTRATION_ARGS = Object.freeze([
  DEMONSTRATION_PACT.locationName,
  DEMONSTRATION_PACT.admin1,
  DEMONSTRATION_PACT.country,
  DEMONSTRATION_PACT.countryCode,
  DEMONSTRATION_PACT.latitude,
  DEMONSTRATION_PACT.longitude,
  DEMONSTRATION_PACT.timezone,
  DEMONSTRATION_PACT.targetDate,
  DEMONSTRATION_PACT.metric,
  DEMONSTRATION_PACT.operator,
  DEMONSTRATION_PACT.threshold,
  DEMONSTRATION_PACT.prediction,
]);

export const DEMONSTRATION_SOURCE_URL =
  'https://archive-api.open-meteo.com/v1/archive?latitude=6.5244&longitude=3.3792&start_date=2025-06-15&end_date=2025-06-15&daily=rain_sum&timezone=Africa%2FLagos&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timeformat=iso8601';
export const HISTORICAL_DATASET_NOTE =
  'Historical weather data may be model-derived or reanalysis-based and is not necessarily a direct local weather-station measurement.';

export function sameAddress(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase()
  );
}

export function assertTransactionCalldata(transaction, method, expectedArgs) {
  const raw = transaction?.data?.calldata?.raw;
  if (
    !Array.isArray(raw) ||
    raw.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    throw new Error('Finalized transaction does not contain decoded calldata bytes.');
  }
  let decoded;
  try {
    decoded = abi.calldata.decode(Uint8Array.from(raw));
  } catch {
    throw new Error('Finalized transaction calldata could not be decoded.');
  }
  const decodedMethod = decoded instanceof Map ? decoded.get('method') : decoded?.method;
  const decodedArgs = decoded instanceof Map ? decoded.get('args') : decoded?.args;
  if (!decoded || decodedMethod !== method || !Array.isArray(decodedArgs)) {
    throw new Error(`Finalized transaction was not the expected ${method} call.`);
  }
  if (
    decodedArgs.length !== expectedArgs.length ||
    decodedArgs.some((value, index) => value !== expectedArgs[index])
  ) {
    throw new Error(`Finalized ${method} arguments do not exactly match the authorized input.`);
  }
  return true;
}

export function pactMatchesDemonstration(pact, account = DEMONSTRATION_ACCOUNT) {
  if (!pact || typeof pact !== 'object' || !sameAddress(pact.creator, account)) return false;
  const location = pact.location;
  if (!location || typeof location !== 'object') return false;
  const locationMatches = [
    ['name', DEMONSTRATION_PACT.locationName],
    ['admin1', DEMONSTRATION_PACT.admin1],
    ['country', DEMONSTRATION_PACT.country],
    ['countryCode', DEMONSTRATION_PACT.countryCode],
    ['latitude', DEMONSTRATION_PACT.latitude],
    ['longitude', DEMONSTRATION_PACT.longitude],
    ['timezone', DEMONSTRATION_PACT.timezone],
  ].every(([key, value]) => location[key] === value);
  return (
    locationMatches &&
    ['targetDate', 'metric', 'operator', 'threshold', 'prediction'].every(
      (key) => pact[key] === DEMONSTRATION_PACT[key],
    )
  );
}

export function conditionHolds(observedValue, threshold, operator) {
  const observed = Number(observedValue);
  const boundary = Number(threshold);
  if (!Number.isFinite(observed) || !Number.isFinite(boundary)) {
    throw new Error('Observed value and threshold must be finite numbers.');
  }
  if (operator === 'gte') return observed >= boundary;
  if (operator === 'lte') return observed <= boundary;
  if (operator === 'gt') return observed > boundary;
  if (operator === 'lt') return observed < boundary;
  throw new Error(`Unsupported operator ${operator}.`);
}

export function assertCreatedDemonstration(pact, account = DEMONSTRATION_ACCOUNT) {
  if (!pactMatchesDemonstration(pact, account)) {
    throw new Error(
      'Stored pact does not exactly match the authorized Lagos demonstration and creator.',
    );
  }
  if (!/^WP-\d{10}$/.test(pact.id)) throw new Error('Stored pact has an invalid identifier.');
  if (pact.unit !== 'mm' || !Number.isFinite(Date.parse(pact.createdAt))) {
    throw new Error('Stored pact unit or creation timestamp is invalid.');
  }
  if (!['OPEN', 'READY_TO_RESOLVE', 'RESOLVED_YES', 'RESOLVED_NO'].includes(pact.status)) {
    throw new Error(`Unexpected stored pact status ${pact.status}.`);
  }
  if (pact.readyAt !== '2025-06-22T00:00:00Z') {
    throw new Error(`Unexpected eligibility timestamp ${pact.readyAt}.`);
  }
  return true;
}

export function assertResolvedDemonstration(
  { pact, reputation, activity, metadata },
  account = DEMONSTRATION_ACCOUNT,
) {
  assertCreatedDemonstration(pact, account);
  if (!['RESOLVED_YES', 'RESOLVED_NO'].includes(pact.status)) {
    throw new Error(`Pact is not resolved: ${pact.status}.`);
  }

  const evidence = pact.evidence;
  if (!evidence || evidence.sourceUrl !== DEMONSTRATION_SOURCE_URL) {
    throw new Error('Stored evidence does not contain the exact canonical Open-Meteo request.');
  }
  if (evidence.sourceName !== 'Open-Meteo Historical Weather API') {
    throw new Error('Stored evidence source name is not the Historical Weather API.');
  }
  if (
    evidence.datasetNote !== HISTORICAL_DATASET_NOTE ||
    evidence.providerUtcOffsetSeconds !== '3600'
  ) {
    throw new Error('Stored historical-weather disclosure or provider UTC offset is invalid.');
  }
  if (!sameAddress(evidence.resolver, account))
    throw new Error('Stored resolver is not the demonstration account.');
  if (!Number.isFinite(Number(evidence.observedValue)) || evidence.unit !== 'mm') {
    throw new Error('Stored rainfall observation is missing or invalid.');
  }
  if (
    !Number.isFinite(Date.parse(evidence.resolvedAt)) ||
    evidence.providerTimezone !== 'Africa/Lagos'
  ) {
    throw new Error('Stored evidence timestamp or provider timezone is invalid.');
  }
  for (const coordinate of [evidence.providerLatitude, evidence.providerLongitude]) {
    if (!Number.isFinite(Number(coordinate)))
      throw new Error('Stored provider coordinates are invalid.');
  }
  if (
    Math.abs(Number(evidence.providerLatitude) - Number(pact.location.latitude)) > 0.25 ||
    Math.abs(Number(evidence.providerLongitude) - Number(pact.location.longitude)) > 0.25
  ) {
    throw new Error('Stored provider coordinates exceed the contract grid tolerance.');
  }

  const outcome = conditionHolds(evidence.observedValue, pact.threshold, pact.operator);
  const expectedStatus = outcome ? 'RESOLVED_YES' : 'RESOLVED_NO';
  if (pact.status !== expectedStatus) {
    throw new Error(
      `Stored status ${pact.status} contradicts the stored observation; expected ${expectedStatus}.`,
    );
  }
  const correct = (outcome ? 'YES' : 'NO') === pact.prediction;
  if (!reputation || Number(reputation.finalizedPacts) !== 1) {
    throw new Error('Creator finalized-pact reputation did not become exactly one.');
  }
  if (Number(reputation.correctPredictions) !== (correct ? 1 : 0)) {
    throw new Error('Creator correct-prediction reputation does not match the stored outcome.');
  }
  if (Number(reputation.currentStreak) !== (correct ? 1 : 0)) {
    throw new Error('Creator streak does not match the stored outcome.');
  }
  if (
    !metadata ||
    metadata.name !== 'WeatherPact' ||
    Number(metadata.version) !== 1 ||
    Number(metadata.resolutionDelayDays) !== 7 ||
    metadata.sourceName !== 'Open-Meteo Historical Weather API' ||
    metadata.sourceHost !== 'https://archive-api.open-meteo.com'
  ) {
    throw new Error('Final WeatherPact metadata does not match the verified contract.');
  }
  if (Number(metadata.pactCount) !== 1 || Number(metadata.activityCount) !== 2) {
    throw new Error('Final contract counts must contain one pact and two activities.');
  }

  const related = Array.isArray(activity)
    ? activity.filter((item) => item?.pactId === pact.id)
    : [];
  const created = related.filter((item) => item.type === 'CREATED');
  const resolved = related.filter((item) => item.type === 'RESOLVED');
  if (created.length !== 1 || resolved.length !== 1) {
    throw new Error(
      'Final activity must contain exactly one creation and one resolution for the pact.',
    );
  }
  if (!sameAddress(created[0].actor, account) || !sameAddress(resolved[0].actor, account)) {
    throw new Error('Final activity actors do not match the demonstration account.');
  }
  return { conditionHolds: outcome, correctPrediction: correct };
}
