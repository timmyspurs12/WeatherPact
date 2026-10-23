import { createHash } from 'node:crypto';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';

const endpoint = 'https://rpc-bradbury.genlayer.com';
const originalFetch = globalThis.fetch;
let requestBody = '';
let responseBody = '';
let httpStatus = null;
let responseHeaders = null;

globalThis.fetch = async (input, init = {}) => {
  requestBody = typeof init.body === 'string' ? init.body : String(init.body ?? '');
  const response = await originalFetch(input, init);
  responseBody = await response.clone().text();
  httpStatus = `${response.status} ${response.statusText}`.trim();
  responseHeaders = {
    contentType: response.headers.get('content-type'),
    vary: response.headers.get('vary'),
  };
  return response;
};

const client = createClient({ chain: testnetBradbury, endpoint });
let sdkError = null;
try {
  await client.readContract({
    address: '0x0000000000000000000000000000000000000000',
    functionName: 'get_metadata',
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
} catch (error) {
  sdkError = error instanceof Error ? error.message : String(error);
} finally {
  globalThis.fetch = originalFetch;
}

const metadata = JSON.stringify({
  note: 'Zero-address method-availability diagnostic only; not a successful contract read.',
  request: JSON.parse(requestBody),
  httpStatus,
  responseHeaders,
  sdkError: sdkError ? `${sdkError.slice(0, 500)}${sdkError.length > 500 ? '…' : ''}` : null,
  responseUtf8Bytes: Buffer.byteLength(responseBody, 'utf8'),
  responseSha256: createHash('sha256').update(responseBody, 'utf8').digest('hex'),
});
console.log(
  `::notice title=gen_call exchange metadata::${metadata.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`,
);

if (!responseBody) throw new Error('No gen_call response body was captured.');
const encoded = Buffer.from(responseBody, 'utf8').toString('base64');
const chunkSize = 3_000;
const chunks = Math.ceil(encoded.length / chunkSize);
for (let index = 0; index < chunks; index += 1) {
  console.log(
    `::notice title=gen_call response base64 (${index + 1}/${chunks})::${encoded.slice(index * chunkSize, (index + 1) * chunkSize)}`,
  );
}
