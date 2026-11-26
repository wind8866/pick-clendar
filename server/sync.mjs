import { existsSync } from 'node:fs'
import {
  CALENDARS,
  FETCH_MAX_MONTHS,
  FETCH_MONTHS_AHEAD,
} from './config.mjs'
import { authStatus, getAuthorization, refreshAuthorization } from './auth.mjs'
import { CfaAuthError, fetchMonths } from './cfa-client.mjs'
import { groupScreens } from './normalize.mjs'
import { contentHash, EmptyIncomingError, mergeConfig } from './merge.mjs'
import {
  ensureDirs,
  icsPath,
  loadRuntime,
  loadSeed,
  loadSyncState,
  saveSyncState,
  writeCalendar,
  writeIcs,
  writeIndex,
  writeStatus,
} from './store.mjs'
import { buildSubscribeIcs, rollingIcsEvents } from './ics.mjs'
import { sendAlert } from './alerts.mjs'
import { addMonths, dateKey, monthKey, monthLabel, zonedParts } from './time.mjs'

let running = false

function monthIndex(label) {
  const [year, month] = label.split('-').map(Number)
  return year * 12 + month - 1
}

function monthsToFetch(seeds, now) {
  const p = zonedParts(now)
  const currentIndex = p.year * 12 + p.month - 1
  const labels = new Set()

  for (let i = 0; i <= FETCH_MONTHS_AHEAD; i += 1) {
    const item = addMonths(p.year, p.month, i)
    labels.add(monthLabel(item.year, item.month))
  }

  // 如果现有数据比“下下月”还晚，就把窗口延长到已有数据的最后一个月
  for (const config of seeds.values()) {
    for (const event of config.events || []) {
      if (event.kind === 'header') continue
      const label = monthKey(event.start)
      const index = monthIndex(label)
      if (index <= currentIndex) continue
      if (index - currentIndex >= FETCH_MAX_MONTHS) continue
      labels.add(label)
    }
  }

  return [...labels]
    .sort()
    .map((label) => {
      const [year, month] = label.split('-').map(Number)
      return { year, month, label }
    })
}

function validateConfig(config) {
  const events = config.events.filter((event) => event.kind !== 'header')
  if (!events.length) throw new Error(`${config.id} 合并后没有场次`)

  const ids = new Set()
  for (const event of events) {
    if (!event.id) throw new Error(`${config.id} 有场次缺少 id`)
    if (ids.has(event.id)) throw new Error(`${config.id} 有重复 id：${event.id}`)
    ids.add(event.id)
    if (!Number.isFinite(new Date(event.start).getTime())) {
      throw new Error(`${config.id} 有非法开始时间：${event.start}`)
    }
    if (!(Number(event.durationMinutes) > 0)) {
      throw new Error(`${config.id} 有非法时长：${event.id}`)
    }
  }
}

function futureCount(config, now) {
  return (config?.events || []).filter(
    (event) => event.kind !== 'header' && new Date(event.start).getTime() >= now.getTime(),
  ).length
}

function countByCalendar(configs) {
  return Object.fromEntries(
    configs.map((config) => [
      config.id,
      config.events.filter((event) => event.kind !== 'header').length,
    ]),
  )
}

async function fetchWithAuth(months) {
  let auth = await getAuthorization()
  try {
    return { auth, screens: await fetchMonths(auth.authorization, months) }
  } catch (error) {
    if (!(error instanceof CfaAuthError)) throw error
    console.warn('[auth] 接口返回未登录，强制重新登录后重试一次')
    auth = await refreshAuthorization()
    return { auth, screens: await fetchMonths(auth.authorization, months) }
  }
}

/**
 * 同步一次：
 * 1. 抓当前月 + 下月 + 下下月；
 * 2. 按影院拆分、规范化；
 * 3. 网页配置 = 历史归档 + 本次未来窗口；
 * 4. 订阅 ICS = 过去 3 天 ~ 下下月月底的滚动窗口。
 */
export async function runSync({ reason = 'manual' } = {}) {
  if (running) {
    console.warn('[sync] 上一轮还没结束，跳过本轮')
    return { skipped: true }
  }
  running = true
  const startedAt = new Date()
  let months = []
  let state = { calendars: {} }

  try {
    await ensureDirs()

    const seeds = new Map()
    for (const calendar of CALENDARS) {
      seeds.set(calendar.id, await loadSeed(calendar.id))
    }

    months = monthsToFetch(seeds, startedAt)
    console.log(`[sync] ${reason} 开始，月份：${months.map((item) => item.label).join(', ')}`)

    state = await loadSyncState()
    const { auth, screens } = await fetchWithAuth(months)
    const { grouped, unmapped, invalid } = groupScreens(screens)

    const configs = new Map()
    const prepared = []
    const results = []
    const warnings = []

    for (const calendar of CALENDARS) {
      const seed = seeds.get(calendar.id)
      const previousRaw = await loadRuntime(calendar.id)
      const previous =
        previousRaw?.id === calendar.id && Array.isArray(previousRaw.events) && previousRaw.events.length
          ? previousRaw
          : null
      const base = previous || seed
      configs.set(calendar.id, base)

      const incoming = grouped.get(calendar.id) || []
      if (!incoming.length && futureCount(base, startedAt) > 0) {
        const message = `${calendar.id} 本轮 0 场，但旧数据还有 ${futureCount(base, startedAt)} 场未来场次；保留旧数据`
        warnings.push(message)
        console.warn(`[sync] ${message}`)
        continue
      }

      let merged
      try {
        merged = mergeConfig({ seed, previous, incoming, now: startedAt })
      } catch (error) {
        if (error instanceof EmptyIncomingError) {
          warnings.push(error.message)
          console.warn(`[sync] ${error.message}`)
          continue
        }
        throw error
      }

      validateConfig(merged.config)

      const hash = contentHash(merged.config.events)
      const previousState = state.calendars?.[calendar.id] || {}
      const previousHash = previousState.hash || (previous ? contentHash(previous.events) : '')
      const changed = hash !== previousHash
      merged.config.updatedAt = changed
        ? dateKey(startedAt)
        : previous?.updatedAt || merged.config.updatedAt

      const ics = rollingIcsEvents(merged.config, startedAt)
      const icsHash = contentHash(ics.events)
      const previousIcs = previousState.ics || {}
      const icsChanged =
        ics.windowKey !== previousIcs.windowKey ||
        icsHash !== previousIcs.hash ||
        !existsSync(icsPath(calendar.id))

      prepared.push({
        id: calendar.id,
        config: merged.config,
        previous,
        hash,
        ics,
        icsHash,
        changed,
        icsChanged,
      })
      configs.set(calendar.id, merged.config)
      results.push({
        id: calendar.id,
        total: merged.events.length,
        ics: ics.events.length,
        changed,
        icsChanged,
        updatedAt: merged.config.updatedAt,
      })
      console.log(
        `[sync] ${calendar.id}：${merged.events.length} 场，订阅 ${ics.events.length} 场，` +
          `${changed ? '有更新' : '无变化'}，更新日期 ${merged.config.updatedAt}`,
      )
    }

    // 先把两份配置都算完并校验，再统一落盘，避免第二份失败时只写了一半
    for (const item of prepared) {
      if (item.changed || !item.previous) {
        await writeCalendar(item.config)
      }
      if (item.icsChanged) {
        await writeIcs(item.id, buildSubscribeIcs(item.config, item.ics.events))
      }
      state.calendars[item.id] = {
        hash: item.hash,
        updatedAt: item.config.updatedAt,
        ics: { windowKey: item.ics.windowKey, hash: item.icsHash },
      }
    }

    await writeIndex([...configs.values()])

    const status = {
      ok: true,
      at: startedAt.toISOString(),
      reason,
      months: months.map((item) => item.label),
      auth: {
        ...authStatus(),
        source: auth.source || authStatus().source,
      },
      counts: countByCalendar([...configs.values()]),
      results,
      unmappedCount: unmapped.length,
      unmapped: unmapped.slice(0, 20),
      invalidCount: invalid.length,
      invalid: invalid.slice(0, 20),
      warnings,
      lastChangedAt: results
        .filter((item) => item.changed)
        .map((item) => item.updatedAt)
        .sort()
        .at(-1) || state.lastChangedAt || null,
    }

    state.lastRunAt = startedAt.toISOString()
    state.lastSuccessAt = startedAt.toISOString()
    state.lastStatus = 'ok'
    state.lastChangedAt = status.lastChangedAt
    await saveSyncState(state)
    await writeStatus(status)

    if (unmapped.length || invalid.length || warnings.length) {
      await sendAlert({
        key: `sync-warnings:${unmapped.length}:${invalid.length}:${warnings.length}`,
        title: '资料馆排片同步有异常',
        body: [
          `月份：${status.months.join(', ')}`,
          `未归类影院：${unmapped.length} 条`,
          `无效场次：${invalid.length} 条`,
          ...warnings.slice(0, 5),
          ...unmapped.slice(0, 3).map((item) => `未知影院：${item.cinema} / ${item.title}`),
        ].join('\n'),
      })
    }

    const authInfo = authStatus()
    if (authInfo.expiresAt) {
      const days = (new Date(authInfo.expiresAt).getTime() - startedAt.getTime()) / 86_400_000
      if (days < 7) {
        await sendAlert({
          key: `token-expiry:${authInfo.expiresAt}`,
          title: '资料馆 token 即将过期',
          body: `token 还剩 ${days.toFixed(1)} 天到期（${authInfo.expiresAt}）。如果自动登录失效，请更新 CFA_AUTHORIZATION。`,
        })
      }
    }

    return { ok: true, months: status.months, results, counts: status.counts, warnings }
  } catch (error) {
    const status = {
      ok: false,
      at: startedAt.toISOString(),
      reason,
      months: months.map((item) => item.label),
      auth: authStatus(),
      error: error.message,
    }
    try {
      await writeStatus(status)
      state.lastRunAt = startedAt.toISOString()
      state.lastErrorAt = startedAt.toISOString()
      state.lastStatus = 'error'
      state.lastError = error.message
      await saveSyncState(state)
    } catch (writeError) {
      console.error(`[sync] 写状态失败：${writeError.message}`)
    }

    console.error(`[sync] 失败：${error.stack || error.message}`)
    await sendAlert({
      key: `sync-error:${error.name}:${error.message}`,
      title: '资料馆排片同步失败',
      body: [
        `原因：${error.message}`,
        `月份：${months.map((item) => item.label).join(', ') || '未开始'}`,
        '已保留上一份可用数据；请检查账号、验证码或网络。',
      ].join('\n'),
    })
    throw error
  } finally {
    running = false
  }
}
