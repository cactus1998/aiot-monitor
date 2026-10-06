// Usage: node scripts/bundle-size.mjs apps/web/dist OverviewView
// Sum gzip size of every JS chunk statically reachable from the entry + a route chunk.
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
const dir = process.argv[2]
const route = process.argv[3]
const assets = join(dir, 'assets')
const files = readdirSync(assets).filter((f) => f.endsWith('.js'))
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const entry = html.match(/src="\.\/assets\/([^"]+\.js)"/)[1]
const seen = new Set()
const visit = (f) => {
  if (seen.has(f)) return
  seen.add(f)
  const code = readFileSync(join(assets, f), 'utf8')
  for (const m of code.matchAll(/(?:import|from)\s*["']\.\/([^"']+\.js)["']/g)) visit(m[1])
}
visit(entry)
const routeFile = files.find((f) => f.startsWith(route))
if (routeFile) visit(routeFile)
let total = 0
for (const f of seen) {
  const g = gzipSync(readFileSync(join(assets, f))).length
  total += g
  console.log(String(Math.round((g / 1024) * 10) / 10).padStart(7), 'KB', f)
}
console.log('total gzip', Math.round((total / 1024) * 10) / 10, 'KB')
