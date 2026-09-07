/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { Deflate, Inflate } from "pako";

export interface CompressionProvider {
  deflate(data: Uint8Array): Uint8Array;
  inflate(data: Uint8Array, maxOutputBytes?: number): Uint8Array;
}

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export const pakoCompressionProvider: CompressionProvider = {
  deflate(data) {
    if (!(data instanceof Uint8Array)) throw new TypeError("Compression input must be Uint8Array");
    const compressor = new Deflate({ raw: true });
    compressor.push(data, true);
    if (compressor.err) throw new Error(compressor.msg || "Unable to compress signing request");
    if (!(compressor.result instanceof Uint8Array)) {
      throw new TypeError("Compression provider returned invalid output");
    }
    return compressor.result;
  },

  inflate(data, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES) {
    if (!(data instanceof Uint8Array)) throw new TypeError("Compression input must be Uint8Array");
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
      throw new RangeError("maxOutputBytes must be a positive safe integer");
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    const inflater = new Inflate({ raw: true, chunkSize: 32 * 1024 });
    inflater.onData = (chunk: Uint8Array) => {
      total += chunk.length;
      if (total > maxOutputBytes) {
        throw new RangeError("Inflated signing request exceeds the configured size limit");
      }
      chunks.push(chunk.slice());
    };
    inflater.push(data, true);
    if (inflater.err) throw new Error(inflater.msg || "Unable to decompress signing request");
    return concat(chunks, total);
  },
};
