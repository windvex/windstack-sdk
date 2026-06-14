export type RuntimeWindow = Window & Record<string, unknown>;

export function getRuntimeWindow(): RuntimeWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as unknown as RuntimeWindow;
}

export function hasRuntimeWindow(): boolean {
  return typeof window !== "undefined";
}
