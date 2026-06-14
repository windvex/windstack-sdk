import type { VexaniumProvider } from "./types.js";

declare global {
  interface Window {
    vexanium?: VexaniumProvider;
  }
}

export {};
