import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';

const nodeUrl = 'https://rpc-bradbury.genlayer.com';
const chainUrl = 'https://rpc.testnet-chain.genlayer.com';
const origin = 'https://weatherpact.vercel.app';
const expected = {
  chainId: 4221,
  genesis: '0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4',
  addressManager: '0x3F71AE080BD6270A91dBcc7960d88797828538E0',
};
const consensusAddress = testnetBradbury.consensusMainContract?.address;
if (!consensusAddress)
  throw new Error('The pinned SDK lacks Bradbury ConsensusMain configuration.');

const addressManagerAbi = parseAbi(['function getAddressManager() view returns (address)']);
const managerPointerData = encodeFunctionData({
  abi: addressManagerAbi,
  functionName: 'getAddressManager',
});
let requestId = 0;

function printable(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item), 2);
}

function escapeCommand(value) {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function emit(title, value) {
  const text = printable(value);
  console.log(`\n=== ${title} ===\n${text}`);
  const chunkSize = 12_000;
  const chunks = Math.max(1, Math.ceil(text.length / chunkSize));
  for (let index = 0; index < chunks; index += 1) {
    const suffix = chunks > 1 ? ` (${index + 1}/${chunks})` : '';
    console.log(
      `::notice title=${escapeCommand(title + suffix)}::${escapeCommand(text.slice(index * chunkSize, (index + 1) * chunkSize))}`,
    );
  }
}

function selectedHeaders(response) {
  const names = [
    'content-type',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials',
    'vary',
  ];
  return Object.fromEntries(
    names.map((name) => [name, response.headers.get(name)]).filter(([, value]) => value !== null),
  );
}

function parseBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function rawRpc(label, url, method, params = [], options = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params });
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.origin ? { Origin: options.origin } : {}),
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const responseBody = await response.text();
    emit(
      label,
      [
        `URL: ${url}`,
        `Request body: ${options.requestDescription ?? body}`,
        `HTTP status: ${response.status} ${response.statusText}`.trim(),
        `Response headers: ${JSON.stringify(selectedHeaders(response))}`,
        'Response body:',
        responseBody || '<empty body>',
      ].join('\n'),
    );
    return {
      httpStatus: response.status,
      headers: selectedHeaders(response),
      body: responseBody,
      json: parseBody(responseBody),
    };
  } catch (error) {
    emit(
      label,
      [
        `URL: ${url}`,
        `Request body: ${options.requestDescription ?? body}`,
        `Transport error: ${error instanceof Error ? error.message : String(error)}`,
      ].join('\n'),
    );
    return { transportError: error instanceof Error ? error.message : String(error) };
  }
}

async function sdkProbe(label, operation) {
  const originalFetch = globalThis.fetch;
  const exchanges = [];
  globalThis.fetch = async (input, init = {}) => {
    const requestBody = typeof init.body === 'string' ? init.body : String(init.body ?? '');
    try {
      const response = await originalFetch(input, init);
      const responseBody = await response.clone().text();
      exchanges.push({
        requestBody,
        httpStatus: `${response.status} ${response.statusText}`.trim(),
        responseHeaders: selectedHeaders(response),
        responseBody: responseBody || '<empty body>',
      });
      return response;
    } catch (error) {
      exchanges.push({
        requestBody,
        transportError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
  try {
    const result = await operation();
    emit(label, {
      sdkOutcome: 'success',
      sdkResult: result,
      exchanges,
    });
  } catch (error) {
    emit(label, {
      sdkOutcome: 'error',
      sdkError: error instanceof Error ? error.message : String(error),
      exchanges,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function resultOf(probe) {
  return probe?.json && 'result' in probe.json ? probe.json.result : null;
}

function codeSummary(probe) {
  const code = resultOf(probe);
  if (typeof code !== 'string')
    return { result: code ?? null, rpcError: probe?.json?.error ?? null };
  return {
    hexCharacters: code.length,
    bytes: code.startsWith('0x') ? (code.length - 2) / 2 : null,
    sha256: createHash('sha256').update(code).digest('hex'),
    result: code.length <= 130 ? code : `${code.slice(0, 66)}…${code.slice(-64)}`,
  };
}

function pointerSummary(probe) {
  const result = resultOf(probe);
  if (typeof result !== 'string')
    return { result: result ?? null, rpcError: probe?.json?.error ?? null };
  try {
    return {
      result,
      decodedAddress: decodeFunctionResult({
        abi: addressManagerAbi,
        functionName: 'getAddressManager',
        data: result,
      }),
    };
  } catch (error) {
    return { result, decodeError: error instanceof Error ? error.message : String(error) };
  }
}

const candidate = {};
const chain = {};
for (const [role, url, store] of [
  ['candidate node', nodeUrl, candidate],
  ['underlying chain', chainUrl, chain],
]) {
  store.chainId = await rawRpc(`${role} — eth_chainId`, url, 'eth_chainId');
  store.genesis = await rawRpc(`${role} — eth_getBlockByNumber(0)`, url, 'eth_getBlockByNumber', [
    '0x0',
    false,
  ]);
  store.managerCode = await rawRpc(`${role} — eth_getCode(AddressManager)`, url, 'eth_getCode', [
    expected.addressManager,
    'latest',
  ]);
  store.managerPointer = await rawRpc(
    `${role} — eth_call(ConsensusMain.getAddressManager)`,
    url,
    'eth_call',
    [{ to: consensusAddress, data: managerPointerData }, 'latest'],
  );
}

const candidateCode = resultOf(candidate.managerCode);
const chainCode = resultOf(chain.managerCode);
emit('Identity summary', {
  expected,
  consensusMain: consensusAddress,
  candidate: {
    chainIdHex: resultOf(candidate.chainId),
    chainIdDecimal:
      typeof resultOf(candidate.chainId) === 'string' ? Number(resultOf(candidate.chainId)) : null,
    chainIdRpcError: candidate.chainId?.json?.error ?? null,
    genesisHash: resultOf(candidate.genesis)?.hash ?? null,
    genesisRpcError: candidate.genesis?.json?.error ?? null,
    addressManagerCode: codeSummary(candidate.managerCode),
    consensusMainAddressManager: pointerSummary(candidate.managerPointer),
  },
  underlyingChain: {
    chainIdHex: resultOf(chain.chainId),
    chainIdDecimal:
      typeof resultOf(chain.chainId) === 'string' ? Number(resultOf(chain.chainId)) : null,
    chainIdRpcError: chain.chainId?.json?.error ?? null,
    genesisHash: resultOf(chain.genesis)?.hash ?? null,
    genesisRpcError: chain.genesis?.json?.error ?? null,
    addressManagerCode: codeSummary(chain.managerCode),
    consensusMainAddressManager: pointerSummary(chain.managerPointer),
  },
  addressManagerCodeComparison: {
    bothReturnedStrings: typeof candidateCode === 'string' && typeof chainCode === 'string',
    exactlyEqual:
      typeof candidateCode === 'string' && typeof chainCode === 'string'
        ? candidateCode.toLowerCase() === chainCode.toLowerCase()
        : null,
  },
});

const source = await readFile('contracts/weatherpact.py', 'utf8');
const sourceBase64 = Buffer.from(source, 'utf8').toString('base64');
emit('Source schema request identity', {
  method: 'gen_getContractSchema',
  parameterStructure: [{ code: '<base64-encoded UTF-8 contract source>' }],
  sourcePath: 'contracts/weatherpact.py',
  sourceUtf8Bytes: Buffer.byteLength(source, 'utf8'),
  sourceBase64Characters: sourceBase64.length,
  sourceSha256: createHash('sha256').update(source, 'utf8').digest('hex'),
});

const client = createClient({ chain: testnetBradbury, endpoint: nodeUrl });
await sdkProbe('SDK gen_getContractSchema — full WeatherPact source', () =>
  client.getContractSchemaForCode(source),
);
await sdkProbe('SDK gen_call — zero-address method-availability diagnostic only', () =>
  client.readContract({
    address: '0x0000000000000000000000000000000000000000',
    functionName: 'get_metadata',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  }),
);

try {
  const preflight = await fetch(nodeUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await preflight.text();
  emit('Candidate browser CORS preflight', {
    request: {
      method: 'OPTIONS',
      origin,
      accessControlRequestMethod: 'POST',
      accessControlRequestHeaders: 'content-type',
    },
    httpStatus: `${preflight.status} ${preflight.statusText}`.trim(),
    responseHeaders: selectedHeaders(preflight),
    responseBody: body || '<empty body>',
  });
} catch (error) {
  emit('Candidate browser CORS preflight', {
    transportError: error instanceof Error ? error.message : String(error),
  });
}
await rawRpc('Candidate browser-origin POST diagnostic', nodeUrl, 'eth_chainId', [], { origin });
