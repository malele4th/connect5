/** 联网房间号长度；创建房间与加入校验一致。 */
export const ROOM_ID_LENGTH = 4

/**
 * 创建房间随机号与手动输入允许的字符（均为小写语义，输入会转小写）。
 * 须与 {@link ROOM_ID_RE} 一致。
 */
export const ROOM_ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 联网房间号：固定 {@link ROOM_ID_LENGTH} 位，仅 0-9 与 a-z。 */
export const ROOM_ID_RE = new RegExp(
  `^[0-9a-z]{${ROOM_ID_LENGTH}}$`,
)

/** 用于 `<input pattern>`（不含 ^$，由浏览器匹配整段）。 */
export const ROOM_ID_HTML_PATTERN = `[0-9a-z]{${ROOM_ID_LENGTH}}`

export function parseRoomId(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  return ROOM_ID_RE.test(s) ? s : null
}
