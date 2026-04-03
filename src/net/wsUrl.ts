/**
 * 开发环境走 Vite 代理（/socket → 本机 3003）。
 * 生产默认：与页面同源 + `import.meta.env.BASE_URL` + `socket`（配合 Nginx 反代），例如 /web/connect5/socket。
 * 可用 VITE_WS_URL 覆盖完整 ws(s) URL。
 */
export function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined
  if (explicit) return explicit
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (import.meta.env.DEV) return `${proto}//${location.host}/socket`
  const base = import.meta.env.BASE_URL
  return `${proto}//${location.host}${base}socket`
}
