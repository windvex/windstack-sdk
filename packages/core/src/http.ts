export class ResponseSizeError extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`HTTP response exceeds the ${maxBytes}-byte limit`);
    this.name = "ResponseSizeError";
    this.maxBytes = maxBytes;
  }
}

export async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && BigInt(contentLength) > BigInt(maxBytes)) {
    await response.body?.cancel();
    throw new ResponseSizeError(maxBytes);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ResponseSizeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
