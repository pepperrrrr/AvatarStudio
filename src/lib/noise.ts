/** 种子化伪随机数生成器，同一种子输出序列完全一致 */
export function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 种子化 2D 梯度噪声，返回值约在 [-1, 1] */
export function createNoise2D(seed: number) {
  const rand = mulberry32(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  const grad = (hash: number, x: number, y: number) => {
    switch (hash & 3) {
      case 0: return x + y
      case 1: return -x + y
      case 2: return x - y
      default: return -x - y
    }
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a)

  return (x: number, y: number) => {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const bl = grad(perm[perm[X] + Y], xf, yf)
    const br = grad(perm[perm[X + 1] + Y], xf - 1, yf)
    const tl = grad(perm[perm[X] + Y + 1], xf, yf - 1)
    const tr = grad(perm[perm[X + 1] + Y + 1], xf - 1, yf - 1)
    const u = fade(xf)
    const v = fade(yf)
    return lerp(lerp(bl, br, u), lerp(tl, tr, u), v)
  }
}

/** 分形叠加噪声（fBm），octaves 越高细节越丰富 */
export function fbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
