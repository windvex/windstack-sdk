/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { request as httpRequest } from "node:http";
import { KeosdError, type KeosdTransport } from "./keosd.js";

export type KeosdUnixTransportOptions = {
  socketPath: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export class KeosdUnixTransport implements KeosdTransport {
  readonly socketPath: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(options: KeosdUnixTransportOptions) {
    if (!options.socketPath?.startsWith("/"))
      throw new TypeError("keosd Unix socketPath must be absolute");
    this.socketPath = options.socketPath;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 256 * 1024;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 100)
      throw new RangeError("keosd timeoutMs must be at least 100");
    if (!Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1024)
      throw new RangeError("keosd maxResponseBytes must be at least 1024");
  }

  request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!path.startsWith("/v1/wallet/"))
      return Promise.reject(new TypeError("Unsupported keosd path"));
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new KeosdError("keosd request aborted", { path }));
        return;
      }
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const request = httpRequest(
        {
          socketPath: this.socketPath,
          path,
          method: "POST",
          headers: {
            accept: "application/json",
            ...(payload === undefined
              ? {}
              : {
                  "content-type": "application/json",
                  "content-length": Buffer.byteLength(payload),
                }),
          },
          signal,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.byteLength;
            if (size > this.#maxResponseBytes) {
              request.destroy(new KeosdError("keosd response exceeded the size limit", { path }));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            const status = response.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              reject(new KeosdError(`keosd returned HTTP ${status}`, { status, path }));
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (cause) {
              reject(new KeosdError("keosd returned invalid JSON", { status, path, cause }));
            }
          });
        },
      );
      request.setTimeout(this.#timeoutMs, () =>
        request.destroy(
          new KeosdError(`keosd request timed out after ${this.#timeoutMs}ms`, { path }),
        ),
      );
      request.on("error", (error) =>
        reject(
          error instanceof KeosdError
            ? error
            : new KeosdError("keosd request failed", { path, cause: error }),
        ),
      );
      if (payload !== undefined) request.write(payload);
      request.end();
    });
  }
}

export { KeosdError, KeosdHttpTransport, KeosdSigner } from "./keosd.js";
export type { KeosdHttpTransportOptions, KeosdSignerOptions, KeosdTransport } from "./keosd.js";
