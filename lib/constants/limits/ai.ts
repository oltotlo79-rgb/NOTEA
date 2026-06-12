export const AI_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const FREE_AI_PROVIDERS: readonly AiProvider[] = ['gemini']
export const FREE_AI_DAILY_LIMIT = 5
export const PAID_AI_DAILY_LIMIT = 100
