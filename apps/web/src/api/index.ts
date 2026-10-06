import { createHttpClient } from './http.ts'
import type { ApiClient, ApiMode } from './types.ts'

export * from './errors.ts'
export * from './types.ts'

/** `vite --mode mock` (dev:mock, build:mock) or VITE_API_MODE=mock selects the in-browser mock. */
export const CONFIGURED_MODE: ApiMode =
  import.meta.env.MODE === 'mock' || import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'http'

/** The mock client (and the simulator it runs) is only downloaded when needed. */
export async function createApiClient(mode: ApiMode): Promise<ApiClient> {
  if (mode === 'mock') {
    const { createMockClient } = await import('./mock.ts')
    return createMockClient()
  }
  return createHttpClient()
}
