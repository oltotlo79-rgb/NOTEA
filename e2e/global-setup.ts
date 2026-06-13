import { execSync } from 'child_process'
import path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..')

/**
 * ラン開始時に DB を seed 済みクリーン状態にする。
 *
 * 本番ビルド起動後は全ルートが事前コンパイル済みのため、
 * dev モード向けのウォームアップは不要。
 * 各テストの beforeEach で cleanupSeedUserPages() を呼び per-test 分離する。
 *
 * supabase db reset は DB コンテナを再起動するため、完了後に
 * Supabase が安定するまで少し待つ。
 */
export default async function globalSetup() {
  execSync('npx supabase db reset', {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    timeout: 120000,
  })

  // supabase db reset 後にコンテナが安定するまで待つ
  await new Promise((resolve) => setTimeout(resolve, 3000))
}
