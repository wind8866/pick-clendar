import { CALENDARS } from './config.mjs'

export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function yearText(value) {
  const raw = cleanText(value)
  if (!raw || raw === '0') return ''
  if (/^\d{4}$/.test(raw)) return `${raw}年`
  if (/^\d{4}\s*-\s*\d{4}$/.test(raw)) return raw.replace(/\s*-\s*/, '-')
  return raw
}

function typeText(value) {
  return cleanText(value)
    .split(/[\s/]+/)
    .filter(Boolean)
    .join('/')
}

function toStart(value) {
  const match = String(value ?? '').match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return ''
  const [, year, month, day, hour, minute, second = '00'] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`
}

const VENUES = CALENDARS.flatMap((calendar) =>
  calendar.venues.map((venue) => ({ ...venue, calendarId: calendar.id })),
).sort((a, b) => b.prefix.length - a.prefix.length)

/** 把「小西天艺术影院 2号厅」拆成 cfa-beijing +「小西天 2号厅」 */
export function venueOf(cinema) {
  const value = cleanText(cinema)
  for (const venue of VENUES) {
    if (value.startsWith(venue.prefix)) {
      const location = cleanText(value.slice(venue.prefix.length).replace(/^[-·\s]+/, ''))
      return {
        calendarId: venue.calendarId,
        location: location ? `${venue.short} ${location}` : venue.short,
      }
    }
  }
  return null
}

function buildDescription(screen, location) {
  const head = [
    yearText(screen.film_year),
    cleanText(screen.film_area),
    typeText(screen.film_type),
  ]
    .filter(Boolean)
    .join(' ')

  const first = head && location ? `${head} · ${location}` : head || location
  const lines = first ? [first] : []
  const activity = cleanText(screen.activity)
  if (activity) lines.push(activity)
  return lines.join('\n')
}

export function toEvent(screen, venue) {
  const start = toStart(screen.screen_start_time)
  const duration = Number(screen.screen_time_len)
  const title = cleanText(screen.show_name).replace(/^《/, '').replace(/》$/, '').replace(/^🎉\s*/, '')

  if (!start || !title || !Number.isFinite(duration) || duration <= 0) return null

  const activity = cleanText(screen.activity)
  const hasActivity = String(screen.have_activity).toLowerCase() === 'true' || Boolean(activity)
  const year = Number(screen.film_year)

  const event = {
    id: `cfa-${screen.id}`,
    title,
    start,
    durationMinutes: duration,
    description: buildDescription(screen, venue.location),
    url: '',
    location: venue.location,
  }
  if (hasActivity) {
    event.titlePrefix = '🎉'
    event.postScreening = true
  }
  if (activity) event.activity = activity
  if (Number.isInteger(year) && year > 0) event.year = year
  return event
}

export function groupScreens(screens) {
  const grouped = new Map(CALENDARS.map((calendar) => [calendar.id, new Map()]))
  const unmapped = []
  const invalid = []

  for (const screen of screens) {
    const venue = venueOf(screen.screen_cinema)
    if (!venue) {
      unmapped.push({
        id: screen.id,
        cinema: cleanText(screen.screen_cinema),
        title: cleanText(screen.show_name),
        start: screen.screen_start_time,
      })
      continue
    }
    const event = toEvent(screen, venue)
    if (!event) {
      invalid.push({
        id: screen.id,
        cinema: cleanText(screen.screen_cinema),
        title: cleanText(screen.show_name),
        start: screen.screen_start_time,
      })
      continue
    }
    const bucket = grouped.get(venue.calendarId)
    // 同一场次在相邻月份接口里重复时只保留一条
    if (!bucket.has(event.id)) bucket.set(event.id, event)
  }

  return {
    grouped: new Map([...grouped].map(([id, map]) => [id, [...map.values()]])),
    unmapped,
    invalid,
  }
}
