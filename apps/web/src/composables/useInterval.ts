import { onScopeDispose } from 'vue'

/** setInterval that is cleared with the owning component / effect scope. */
export function useInterval(fn: () => void, ms: number): void {
  const timer = setInterval(fn, ms)
  onScopeDispose(() => clearInterval(timer))
}
