/**
 * @module lib/ai/prompts
 * AI 操作ごとのプロンプト構築。純関数のみ（副作用なし）。
 */

export function buildSummarize(text: string): string {
  return `以下のテキストを簡潔に日本語で要約してください。箇条書きや見出しは使わず、自然な文章で3〜5文程度にまとめてください。

テキスト:
${text}`
}

export function buildContinue(text: string): string {
  return `以下のテキストの続きを自然な日本語で書いてください。元のスタイルやトーンを維持し、2〜4文程度で続けてください。

テキスト:
${text}`
}

export function buildTranslate(text: string, sourceLang: string, targetLang: string): string {
  return `以下のテキストを${sourceLang}から${targetLang}に翻訳してください。翻訳文のみを出力し、説明や注釈は加えないでください。

テキスト:
${text}`
}

export function buildAsk(pageText: string, question: string): string {
  const context = pageText.trim()
    ? `以下のページの内容をもとに質問に回答してください。

ページの内容:
${pageText}`
    : 'ページの内容はまだありません。一般的な知識をもとに回答してください。'

  return `${context}

質問:
${question}`
}
