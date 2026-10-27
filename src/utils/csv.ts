import type { ExportItem, FestivalConfig } from '@/types'
import { hm, weekdayLabel, zoned } from '@/utils/time'

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(config: FestivalConfig, items: ExportItem[]): string {
  const tz = config.timeZone
  const anyTravel = items.some((item) => item.travelTime > 0)
  const header = [
    '日期',
    '星期',
    '开始',
    '结束',
    '时长（分钟）',
    '标题',
    '描述',
    ...(anyTravel ? ['路程（分钟）'] : []),
    '链接',
  ]

  const rows = items.map((item) => {
    const start = zoned(item.event.start, tz)
    const end = zoned(item.end, tz)
    return [
      start.format('YYYY-MM-DD'),
      weekdayLabel(start),
      hm(start),
      hm(end),
      item.event.durationMinutes,
      `${item.event.titlePrefix ?? ''}${item.event.title}`,
      item.description,
      ...(anyTravel ? [item.travelTime > 0 ? item.travelTime : ''] : []),
      item.event.url,
    ]
  })

  const content = [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')

  // UTF-8 BOM，保证 Excel 打开中文不乱码
  return `\uFEFF${content}\r\n`
}
