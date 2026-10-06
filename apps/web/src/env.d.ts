/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `http` uses the Node API, `mock` runs the simulator in the browser. */
  readonly VITE_API_MODE?: 'http' | 'mock'
  /** API origin; empty means same origin (Vite proxy in development). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
