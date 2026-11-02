import type { FestivalEvent } from '@/types'

export interface LanePlacement {
  /** 0 起始的列下标 */
  lane: number
  /** 该重叠簇一共分成几列 */
  lanes: number
}

const MINUTE_MS = 60_000

/**
 * 把同一天的场次按重叠关系分列，供周视图并排渲染。
 * - 互相重叠（含首尾相接视为不重叠）的场次落在同一个「重叠簇」；
 * - 簇内用贪心分配列号，簇的总列数即每列宽度；
 * - 只会返回 lanes > 1 的场次，单列时调用方按整格渲染即可。
 */
export function computeLanePlacements(events: FestivalEvent[]): Map<string, LanePlacement> {
  const placements = new Map<string, LanePlacement>()
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )

  let laneEnds: number[] = []
  let cluster: Array<{ id: string; lane: number }> = []
  let clusterEnd = -Infinity

  const flush = () => {
    const lanes = laneEnds.length
    for (const item of cluster) placements.set(item.id, { lane: item.lane, lanes })
    laneEnds = []
    cluster = []
    clusterEnd = -Infinity
  }

  for (const event of sorted) {
    const start = new Date(event.start).getTime()
    const end = start + event.durationMinutes * MINUTE_MS
    if (cluster.length && start >= clusterEnd) flush()

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }

    cluster.push({ id: event.id, lane })
    clusterEnd = Math.max(clusterEnd, end)
  }
  if (cluster.length) flush()
  return placements
}
