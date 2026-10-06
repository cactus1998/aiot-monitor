import { afterEach, describe, expect, it } from 'vitest'
import type { App } from '../app.ts'
import { createTestApp } from '../test-utils.ts'

let app: App
afterEach(async () => {
  await app?.close()
})

/** Read from an SSE response until `predicate` matches the accumulated text. */
async function readUntil(res: Response, predicate: (text: string) => boolean): Promise<string> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  while (!predicate(text)) {
    const { value, done } = await reader.read()
    if (done) break
    text += value
  }
  await reader.cancel()
  return text
}

async function listen() {
  app = (await createTestApp(1)).app
  await app.listen({ port: 0, host: '127.0.0.1' })
  const { port } = app.server.address() as { port: number }
  return `http://127.0.0.1:${port}/api/stream`
}

describe('GET /api/stream', () => {
  it('sends the retry hint, then reading and alert events', async () => {
    const url = await listen()
    const res = await fetch(url)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    setTimeout(() => {
      app.ctx.hub.publishReadings(5000, [])
      app.ctx.hub.publishAlert({
        id: 1,
        ruleId: 1,
        machineId: 'CNC-01',
        metric: 'temperature',
        op: 'gt',
        threshold: 85,
        ts: 5000,
        value: 90,
        ackedAt: null,
      })
    }, 50)
    const text = await readUntil(res, (t) => t.includes('event: alert'))
    expect(text).toContain('retry: 2000')
    expect(text).toContain('id: 5000\nevent: reading\ndata: {"ts":5000,"readings":[]}')
    expect(text).toContain('event: alert')
  })

  // EC-05 (sse-stream)
  it('replays missed ticks after Last-Event-ID', async () => {
    const url = await listen()
    for (const ts of [1000, 2000, 3000]) app.ctx.hub.publishReadings(ts, [])
    const res = await fetch(url, { headers: { 'last-event-id': '1000' } })
    const text = await readUntil(res, (t) => t.includes('id: 3000'))
    expect(text).not.toContain('id: 1000\n')
    expect(text).toContain('id: 2000')
    expect(text).toContain('id: 3000')
  })

  it('asks the client to resync when the gap is larger than the buffer', async () => {
    const url = await listen()
    app.ctx.hub.publishReadings(1_000_000, [])
    const res = await fetch(`${url}?lastEventId=1000`)
    const text = await readUntil(res, (t) => t.includes('event: resync'))
    expect(text).toContain('data: {"ts":1000}')
  })
})
