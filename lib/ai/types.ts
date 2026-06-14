import type { AiProvider } from '@/lib/constants/limits/ai'

export type AiOperation = 'summarize' | 'continue' | 'translate' | 'ask'

export type GenerateParams = {
  operation: AiOperation
  /** 操作対象テキスト（要約・続き書き・翻訳・質問のコンテキスト） */
  text: string
  /** 翻訳時の元言語（例: "日本語"） */
  sourceLang?: string
  /** 翻訳時のターゲット言語（例: "英語"） */
  targetLang?: string
  /** 質問文（ask 操作のみ） */
  question?: string
  /** ストリーミングをキャンセルするための AbortSignal */
  signal?: AbortSignal
}

/** provider.generate が呼び出し元に返すエラー種別 */
export type AiErrorKind =
  | 'key_invalid'
  | 'rate_limited'
  | 'network'
  | 'unknown'

export type AiGenerateError = {
  kind: AiErrorKind
  message: string
}

export type AiGenerateResult =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; error: AiGenerateError }

export type AiProviderModule = {
  generate: (params: GenerateParams, key: string) => Promise<AiGenerateResult>
}

/** 翻訳の言語ペア */
export type TranslateLangPair = {
  source: string
  target: string
}

/** /settings/ai ページに渡すプロバイダ情報 */
export type ProviderInfo = {
  provider: AiProvider
  plan: 'free' | 'paid'
}
