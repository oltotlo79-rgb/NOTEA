import type { AiProvider } from '@/lib/constants/limits/ai'

/** localStorage に保存する AI API キーのキー名 */
export const AI_KEY_STORAGE_KEYS: Record<AiProvider, string> = {
  gemini: 'notea_ai_key_gemini',
  openai: 'notea_ai_key_openai',
  anthropic: 'notea_ai_key_anthropic',
}

/** 最後に使用した翻訳言語ペアを保存する localStorage キー名 */
export const AI_LAST_TRANSLATE_LANG_KEY = 'notea_ai_last_translate_lang'

/** 各プロバイダで使用するデフォルトモデル名 */
export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-2.0-flash-lite',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
}

/** プロバイダの表示名 */
export const AI_PROVIDER_DISPLAY_NAMES: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/** 鍵の形式チェック用プレフィックス */
export const AI_KEY_PREFIXES: Record<AiProvider, string> = {
  gemini: 'AIzaSy',
  openai: 'sk-',
  anthropic: 'sk-ant-',
}

/** 鍵取得手順のリンク */
export const AI_KEY_GET_URLS: Record<AiProvider, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
}

/** AI 入力テキストの最大文字数（これを超えた分はトリミング） */
export const AI_MAX_INPUT_CHARS = 8000
