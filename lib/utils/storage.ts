const BYTES_PER_MB = 1024 * 1024
const BYTES_PER_GB = 1024 * 1024 * 1024

/**
 * バイト数を人間が読みやすい単位（MB / GB）に変換する。
 * 1024 MB 未満は MB（小数点1桁）、以上は GB（小数点2桁）で表示する。
 */
export function formatStorageSize(bytes: number): { value: string; unit: string } {
  const mb = bytes / BYTES_PER_MB
  if (mb < 1024) {
    return { value: mb.toFixed(1), unit: 'MB' }
  }
  const gb = bytes / BYTES_PER_GB
  return { value: gb.toFixed(2), unit: 'GB' }
}
