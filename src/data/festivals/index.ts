import type { FestivalConfig } from '@/types'
import { compareStart, dayjs, toDateKey } from '@/utils/time'

const modules = import.meta.glob<FestivalConfig>('./*.json', {
  eager: true,
  import: 'default',
})

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'
const DEFAULT_ITEM_NOUN = '项'
const DEFAULT_FEATURED_LABEL = '映后交流'
const DEFAULT_SAME_TITLE_LABEL = '同片场次'

function fileId(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '')
}

/** 补齐可选/易漏字段，避免新日历少写一个字段就让页面锚点崩掉 */
function normalizeConfig(input: FestivalConfig, id: string): FestivalConfig {
  const events = Array.isArray(input.events) ? input.events : []
  const timeZone = input.timeZone?.trim() || DEFAULT_TIME_ZONE
  const first = events
    .filter((event) => event.kind !== 'header')
    .sort((a, b) => compareStart(a.start, b.start))[0]
  const fallbackDate = first
    ? toDateKey(first.start, timeZone)
    : dayjs().tz(timeZone).format('YYYY-MM-DD')

  return {
    ...input,
    schemaVersion: input.schemaVersion ?? 2,
    id,
    name: input.name?.trim() || id,
    timeZone,
    initialDate: input.initialDate?.trim() || fallbackDate,
    itemNoun: input.itemNoun?.trim() || DEFAULT_ITEM_NOUN,
    subscribeUrl: input.subscribeUrl?.trim() || undefined,
    labels: {
      featured: input.labels?.featured ?? DEFAULT_FEATURED_LABEL,
      sameTitle: input.labels?.sameTitle ?? DEFAULT_SAME_TITLE_LABEL,
    },
    events,
  }
}

function buildConfigs(): FestivalConfig[] {
  const seen = new Set<string>()
  const configs: FestivalConfig[] = []
  for (const [path, raw] of Object.entries(modules)) {
    const id = raw?.id?.trim() || fileId(path)
    if (!id) continue
    if (seen.has(id)) {
      console.warn(`[festivals] 日历 id 重复，已忽略：${path}`)
      continue
    }
    seen.add(id)
    configs.push(normalizeConfig(raw, id))
  }
  return configs
}

export const festivalConfigs: FestivalConfig[] = buildConfigs()

export function findFestival(id: string | undefined): FestivalConfig | undefined {
  if (!id) return undefined
  return festivalConfigs.find((item) => item.id === id)
}
