// NEXT_PUBLIC_* はビルド時インライン置換されるため process.env.X のリテラル参照を
// 呼び出し側に残し、値だけを受け取って存在を保証する
export function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}
