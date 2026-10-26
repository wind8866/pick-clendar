import type { FestivalConfig, FestivalEvent } from '@/types'

const modules = import.meta.glob<FestivalConfig>('./*.json', {
  eager: true,
  import: 'default',
})

export const festivalConfigs: FestivalConfig[] = Object.values(modules)

export const defaultFestivalId: string =
  festivalConfigs.find((item) => item.isDefault)?.id ?? festivalConfigs[0]?.id ?? ''

export function findFestival(id: string | undefined): FestivalConfig | undefined {
  if (!id) return undefined
  return festivalConfigs.find((item) => item.id === id)
}

export function segmentEvents(
  config: FestivalConfig,
): Map<string, FestivalEvent[]> {
  const map = new Map<string, FestivalEvent[]>()
  for (const event of config.events) {
    const date = event.start.slice(0, 10)
    const bucket = map.get(date)
    if (bucket) bucket.push(event)
    else map.set(date, [event])
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.start.localeCompare(b.start))
  }
  return map
}
