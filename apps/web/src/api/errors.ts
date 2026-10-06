export type ClientErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'TIMEOUT' | 'NETWORK' | 'INVALID_RESPONSE'

export class ApiRequestError extends Error {
  readonly code: ClientErrorCode
  readonly status: number | null

  constructor(code: ClientErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

/** Checks the name instead of `instanceof DOMException`, which differs across realms. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/** Human-readable message for any error thrown by an ApiClient. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof Error) return error.message
  return '發生未知錯誤'
}

export const REQUEST_TIMEOUT_MS = 10_000
