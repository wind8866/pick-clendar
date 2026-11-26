import { runSync } from './sync.mjs'

runSync({ reason: 'cli' })
  .then((result) => {
    if (result?.skipped) {
      console.log('[sync] 已跳过')
      return
    }
    console.log('[sync] 完成')
  })
  .catch((error) => {
    console.error(`[sync] 退出：${error.message}`)
    process.exitCode = 1
  })
