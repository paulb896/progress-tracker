export const resolveImageUrl = (rawUrl: string): string => {
  const url = rawUrl.trim()
  if (!url) return url

  // Leave fully-qualified URLs and data/blob URLs untouched.
  if (/^(https?:|data:|blob:)/i.test(url)) return url

  // If caller already passed a BASE_URL-prefixed path, keep it.
  const baseUrl = import.meta.env.BASE_URL
  if (url.startsWith(baseUrl)) return url

  // Convert site-absolute paths ("/exercises/foo.jpg") into BASE_URL-relative.
  if (url.startsWith('/')) return `${baseUrl}${url.slice(1)}`

  // Leave explicit relative paths alone.
  if (url.startsWith('./') || url.startsWith('../')) return url

  // Treat everything else as app-relative (e.g. "exercises/foo.jpg").
  return `${baseUrl}${url}`
}
