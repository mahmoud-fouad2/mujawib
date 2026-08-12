import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws'

const app = new Hono()
const port = Number(process.env.PORT ?? 8787)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'mujawib-realtime',
    timestamp: new Date().toISOString(),
  }),
)

/** Sprint 1: OpenAI Realtime sideband WebSocket — tool calls + live monitoring */
app.get('/', (c) =>
  c.json({
    message: 'MUJAWIB Realtime Sideband Service',
    endpoints: { health: '/health', websocket: '/sideband' },
  }),
)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[realtime] listening on http://localhost:${info.port}`)
})

const wss = new WebSocketServer({ server: server as unknown as import('http').Server, path: '/sideband' })

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', service: 'mujawib-realtime' }))

  ws.on('message', (data) => {
    // Placeholder: forward to OpenAI Realtime sideband in Sprint 1
    ws.send(JSON.stringify({ type: 'echo', payload: data.toString() }))
  })
})

export default app
