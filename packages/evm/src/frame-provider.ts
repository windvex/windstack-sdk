import type { RequestArguments } from "@windstack/core";
import {
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
  EIP6963_REQUEST_PROVIDER_EVENT,
} from "./constants.js";
import { isEIP6963ProviderInfo } from "./discovery.js";
import type {
  EIP1193Provider,
  EIP6963ProviderInfo,
  EVMProviderEventMap,
} from "./types.js";

const FRAME_CHANNEL = "windstack:evm:frame:v1" as const;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

type FrameRequestMessage = {
  channel: typeof FRAME_CHANNEL;
  type: "request";
  id: string;
  args: RequestArguments<unknown>;
};

type FrameResponseMessage = {
  channel: typeof FRAME_CHANNEL;
  type: "response";
  id: string;
  result?: unknown;
  error?: { code?: number; message: string; data?: unknown };
};

type FrameEventMessage = {
  channel: typeof FRAME_CHANNEL;
  type: "event";
  event: keyof EVMProviderEventMap;
  payload: unknown;
};

type FrameMessage = FrameRequestMessage | FrameResponseMessage | FrameEventMessage;
type ListenerStore = Map<keyof EVMProviderEventMap, Set<(payload: unknown) => void>>;

export type EvmFrameProvider = EIP1193Provider & {
  announce(): void;
  destroy(): void;
};

export type EvmFrameProviderOptions = {
  parentOrigin: string;
  providerInfo: EIP6963ProviderInfo;
  requestTimeoutMs?: number;
  window?: Window;
  parentWindow?: WindowProxy;
};

export type EvmFrameHost = {
  emit<TEvent extends keyof EVMProviderEventMap>(
    event: TEvent,
    payload: EVMProviderEventMap[TEvent],
  ): void;
  destroy(): void;
};

export type EvmFrameHostOptions = {
  allowedOrigin: string;
  sourceWindow: WindowProxy;
  handleRequest(args: RequestArguments<unknown>): Promise<unknown> | unknown;
  window?: Window;
};

function exactHttpsOrigin(value: string, label: string): string {
  const raw = String(value || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be an HTTPS origin`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.origin !== raw.replace(/\/$/u, "")
  ) {
    throw new Error(`${label} must be an exact credential-free HTTPS origin`);
  }
  return parsed.origin;
}

function isFrameMessage(value: unknown): value is FrameMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { channel?: unknown }).channel === FRAME_CHANNEL &&
      typeof (value as { type?: unknown }).type === "string",
  );
}

function requestId(counter: number): string {
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

function errorPayload(error: unknown): FrameResponseMessage["error"] {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown; data?: unknown };
    return {
      ...(typeof value.code === "number" ? { code: value.code } : {}),
      message:
        typeof value.message === "string" && value.message
          ? value.message
          : "Wallet provider request failed.",
      ...(value.data !== undefined ? { data: value.data } : {}),
    };
  }
  return {
    message:
      error instanceof Error
        ? error.message
        : String(error || "Wallet provider request failed."),
  };
}

function providerError(error: NonNullable<FrameResponseMessage["error"]>) {
  const value = new Error(error.message) as Error & {
    code?: number;
    data?: unknown;
  };
  if (typeof error.code === "number") value.code = error.code;
  if (error.data !== undefined) value.data = error.data;
  return value;
}

export function createEvmFrameProvider(
  options: EvmFrameProviderOptions,
): EvmFrameProvider {
  const runtimeWindow = options.window ?? globalThis.window;
  if (!runtimeWindow) throw new Error("Frame provider requires a browser window");
  const targetWindow = options.parentWindow ?? runtimeWindow.parent;
  if (!targetWindow || targetWindow === runtimeWindow) {
    throw new Error("Frame provider must run inside an embedded DApp frame");
  }
  const parentOrigin = exactHttpsOrigin(options.parentOrigin, "parentOrigin");
  if (!isEIP6963ProviderInfo(options.providerInfo)) {
    throw new Error("providerInfo must implement EIP-6963 provider metadata");
  }

  const info = Object.freeze({ ...options.providerInfo });
  const timeoutMs = Math.max(
    1_000,
    Number.isFinite(options.requestTimeoutMs)
      ? Number(options.requestTimeoutMs)
      : DEFAULT_REQUEST_TIMEOUT_MS,
  );
  const listeners: ListenerStore = new Map();
  const pending = new Map<
    string,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let counter = 0;
  let destroyed = false;

  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      destroyed ||
      event.source !== targetWindow ||
      event.origin !== parentOrigin ||
      !isFrameMessage(event.data)
    ) {
      return;
    }

    const message = event.data;
    if (message.type === "response") {
      const current = pending.get(message.id);
      if (!current) return;
      pending.delete(message.id);
      clearTimeout(current.timer);
      if (message.error) current.reject(providerError(message.error));
      else current.resolve(message.result);
      return;
    }

    if (message.type === "event") {
      const current = listeners.get(message.event);
      if (!current) return;
      for (const handler of [...current]) handler(message.payload);
    }
  };

  runtimeWindow.addEventListener("message", onMessage);

  let provider: EvmFrameProvider;
  const announce = () => {
    if (destroyed) return;
    runtimeWindow.dispatchEvent(
      new CustomEvent(EIP6963_ANNOUNCE_PROVIDER_EVENT, {
        detail: Object.freeze({ info, provider }),
      }),
    );
  };

  provider = {
    request<TResult = unknown, TParams = unknown>(
      args: RequestArguments<TParams>,
    ): Promise<TResult> {
      if (destroyed) {
        return Promise.reject(new Error("Frame provider has been destroyed"));
      }
      if (!args || typeof args.method !== "string" || !args.method.trim()) {
        return Promise.reject(
          Object.assign(new Error("Provider request method is required"), {
            code: -32602,
          }),
        );
      }

      const id = requestId(++counter);
      return new Promise<TResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Wallet provider request timed out: ${args.method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (value) => resolve(value as TResult),
          reject,
          timer,
        });
        targetWindow.postMessage(
          {
            channel: FRAME_CHANNEL,
            type: "request",
            id,
            args: args as RequestArguments<unknown>,
          } satisfies FrameRequestMessage,
          parentOrigin,
        );
      });
    },
    on(event, handler) {
      const current = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      current.add(handler as (payload: unknown) => void);
      listeners.set(event, current);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler as (payload: unknown) => void);
    },
    removeListener(event, handler) {
      listeners.get(event)?.delete(handler as (payload: unknown) => void);
    },
    announce,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runtimeWindow.removeEventListener("message", onMessage);
      runtimeWindow.removeEventListener(EIP6963_REQUEST_PROVIDER_EVENT, announce);
      for (const current of pending.values()) {
        clearTimeout(current.timer);
        current.reject(new Error("Frame provider was destroyed"));
      }
      pending.clear();
      listeners.clear();
    },
  };

  runtimeWindow.addEventListener(EIP6963_REQUEST_PROVIDER_EVENT, announce);
  announce();
  return provider;
}

export function createEvmFrameHost(options: EvmFrameHostOptions): EvmFrameHost {
  const runtimeWindow = options.window ?? globalThis.window;
  if (!runtimeWindow) throw new Error("Frame host requires a browser window");
  const allowedOrigin = exactHttpsOrigin(options.allowedOrigin, "allowedOrigin");
  let destroyed = false;

  const post = (message: FrameResponseMessage | FrameEventMessage) => {
    if (!destroyed) options.sourceWindow.postMessage(message, allowedOrigin);
  };

  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      destroyed ||
      event.source !== options.sourceWindow ||
      event.origin !== allowedOrigin ||
      !isFrameMessage(event.data) ||
      event.data.type !== "request"
    ) {
      return;
    }

    const message = event.data;
    void Promise.resolve(options.handleRequest(message.args)).then(
      (result) =>
        post({
          channel: FRAME_CHANNEL,
          type: "response",
          id: message.id,
          result,
        }),
      (error) =>
        post({
          channel: FRAME_CHANNEL,
          type: "response",
          id: message.id,
          error: errorPayload(error),
        }),
    );
  };

  runtimeWindow.addEventListener("message", onMessage);

  return {
    emit(event, payload) {
      post({ channel: FRAME_CHANNEL, type: "event", event, payload });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      runtimeWindow.removeEventListener("message", onMessage);
    },
  };
}
