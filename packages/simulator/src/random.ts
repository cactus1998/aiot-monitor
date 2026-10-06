/** mulberry32: tiny, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Random {
  readonly #next: () => number

  constructor(seed: number) {
    this.#next = mulberry32(seed)
  }

  float(): number {
    return this.#next()
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.#next()
  }

  int(min: number, max: number): number {
    return Math.floor(this.between(min, max + 1))
  }

  /** Approximately normal noise (sum of uniforms), mean 0, standard deviation ≈ sd. */
  gaussian(sd = 1): number {
    return (this.#next() + this.#next() + this.#next() - 1.5) * 2 * sd
  }

  /** True with the probability that an event of `ratePerSec` happens within `dtSec`. */
  happens(ratePerSec: number, dtSec: number): boolean {
    return this.#next() < 1 - Math.exp(-ratePerSec * dtSec)
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.#next() * items.length)]!
  }
}
