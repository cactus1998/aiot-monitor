import type { XY } from './lttb.ts'

export interface Regression {
  /** Change in value per millisecond. */
  slope: number
  intercept: number
  /** Coefficient of determination, 0–1. */
  r2: number
}

/** Ordinary least squares fit of value against ts. Returns null for fewer than 2 distinct points. */
export function linearRegression(points: readonly XY[]): Regression | null {
  const n = points.length
  if (n < 2) return null
  // Center x to keep the sums small; epoch ms squared would lose precision.
  const x0 = points[0]!.ts
  const meanX = points.reduce((s, p) => s + (p.ts - x0), 0) / n
  const meanY = points.reduce((s, p) => s + p.value, 0) / n
  const sxx = points.reduce((s, p) => s + (p.ts - x0 - meanX) ** 2, 0)
  if (sxx === 0) return null
  const sxy = points.reduce((s, p) => s + (p.ts - x0 - meanX) * (p.value - meanY), 0)
  const slope = sxy / sxx
  const intercept = meanY - slope * (meanX + x0)
  const ssTot = points.reduce((s, p) => s + (p.value - meanY) ** 2, 0)
  const ssRes = points.reduce((s, p) => s + (p.value - (slope * p.ts + intercept)) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

export interface ThresholdForecast {
  regression: Regression
  /** UTC ms when the trend line reaches the threshold; null if it never will. */
  eta: number | null
  /** True when the latest fitted value is already past the threshold. */
  reached: boolean
}

/**
 * Estimate when an upward trend reaches `threshold`. Only rising trends are
 * forecast because every alarm threshold in this project is an upper limit.
 */
export function forecastThreshold(
  points: readonly XY[],
  threshold: number,
): ThresholdForecast | null {
  const regression = linearRegression(points)
  if (!regression) return null
  const lastTs = points.at(-1)!.ts
  const fittedNow = regression.slope * lastTs + regression.intercept
  if (fittedNow >= threshold) return { regression, eta: lastTs, reached: true }
  if (regression.slope <= 0) return { regression, eta: null, reached: false }
  const eta = (threshold - regression.intercept) / regression.slope
  return { regression, eta: Math.round(eta), reached: false }
}
