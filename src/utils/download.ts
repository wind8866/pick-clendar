import { browserTimestamp } from '@/utils/time'

export function safeFilenamePart(input: string): string {
  const safe = input
    .replace(/[\\/:*?"<>|\r\n]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return safe || 'calendar'
}

export function exportFilename(name: string, extension: string, tag?: string): string {
  const parts = [safeFilenamePart(name)]
  if (tag) parts.push(safeFilenamePart(tag))
  parts.push(browserTimestamp())
  return `${parts.join('-')}.${extension}`
}

export function downloadBlob(content: BlobPart, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}
