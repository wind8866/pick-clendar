import { ALERT } from './config.mjs'

let lastAlert = { key: '', at: 0 }

function truncate(value, max = 1800) {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

/**
 * 告警只做“尽力而为”，发送失败不能影响同步本身。
 * 支持 Bark（默认推荐）、企业微信机器人、Telegram、通用 webhook。
 */
export async function sendAlert({ key, title, body, force = false }) {
  const alertKey = key || title
  if (!force && lastAlert.key === alertKey && Date.now() - lastAlert.at < 60 * 60 * 1000) {
    return
  }
  lastAlert = { key: alertKey, at: Date.now() }

  const text = `${title}\n${body}`
  try {
    if (ALERT.channel === 'bark' && ALERT.barkUrl) {
      await post(ALERT.barkUrl.replace(/\/+$/, ''), {
        title,
        body: truncate(body),
        group: 'calendar-sync',
        level: 'timeSensitive',
      })
      return
    }
    if (ALERT.channel === 'wecom' && ALERT.wecomUrl) {
      await post(ALERT.wecomUrl, {
        msgtype: 'text',
        text: { content: truncate(text) },
      })
      return
    }
    if (ALERT.channel === 'telegram' && ALERT.telegramToken && ALERT.telegramChatId) {
      await post(`https://api.telegram.org/bot${ALERT.telegramToken}/sendMessage`, {
        chat_id: ALERT.telegramChatId,
        text: truncate(text),
        disable_web_page_preview: true,
      })
      return
    }
    if (ALERT.channel === 'webhook' && ALERT.webhookUrl) {
      await post(ALERT.webhookUrl, { title, body: truncate(body), text: truncate(text) })
      return
    }
    console.warn(`[alert] ${text}`)
  } catch (error) {
    console.error(`[alert] 发送失败：${error.message}`)
  }
}
