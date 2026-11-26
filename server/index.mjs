import { SYNC_INTERVAL_HOURS } from './config.mjs'
import { runSync } from './sync.mjs'

let timer = null
let stopping = false

function scheduleNext() {
  if (stopping) return
  const delay = SYNC_INTERVAL_HOURS * 60 * 60 * 1000
  timer = setTimeout(tick, delay)
}

async function tick() {
  if (stopping) return
  try {
    await runSync({ reason: 'schedule' })
  } catch (error) {
    // sync 内部已经写状态并发送告警，这里只记录到 journal
    console.error(`[service] 本轮同步失败：${error.message}`)
  } finally {
    scheduleNext()
  }
}

console.log(`[service] 启动，每 ${SYNC_INTERVAL_HOURS} 小时同步一次`)

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopping = true
    if (timer) clearTimeout(timer)
    console.log(`[service] 收到 ${signal}，退出`)
    process.exit(0)
  })
}

process.on('unhandledRejection', (error) => {
  console.error('[service] unhandledRejection', error)
})

tick()
