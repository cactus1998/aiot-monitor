export interface XY {
  ts: number
  value: number
}

/**
 * Largest-Triangle-Three-Buckets down-sampling.
 * Keeps the first and last point and, for every bucket in between, the point
 * that forms the largest triangle with the previous pick and the next bucket's
 * average. Preserves visual peaks far better than plain averaging.
 */
export function lttb(points: readonly XY[], threshold: number): XY[] {
  if (threshold >= points.length || threshold < 3) return points.slice()

  const sampled: XY[] = [points[0]!]
  const every = (points.length - 2) / (threshold - 2)
  let a = 0

  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, points.length)
    const avgRange = points.slice(avgStart, avgEnd)
    const avgX = avgRange.reduce((s, p) => s + p.ts, 0) / avgRange.length
    const avgY = avgRange.reduce((s, p) => s + p.value, 0) / avgRange.length

    const rangeStart = Math.floor(i * every) + 1
    const rangeEnd = Math.floor((i + 1) * every) + 1
    const pa = points[a]!
    let maxArea = -1
    let next = rangeStart
    for (let j = rangeStart; j < rangeEnd; j++) {
      const p = points[j]!
      const area = Math.abs(
        (pa.ts - avgX) * (p.value - pa.value) - (pa.ts - p.ts) * (avgY - pa.value),
      )
      if (area > maxArea) {
        maxArea = area
        next = j
      }
    }
    sampled.push(points[next]!)
    a = next
  }

  sampled.push(points.at(-1)!)
  return sampled
}
