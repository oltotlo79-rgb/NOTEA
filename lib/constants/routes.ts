export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL_SENT: '/register/verify-email-sent',
  PASSWORD_RESET: '/password-reset',
  PASSWORD_RESET_CONFIRM: '/password-reset/confirm',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_CONFIRM: '/auth/confirm',
  PAGES: '/pages',
  SEARCH: '/search',
  TRASH: '/trash',
  SETTINGS: '/settings',
  SETTINGS_AI: '/settings/ai',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_USAGE: '/settings/usage',
  SETTINGS_ACCOUNT: '/settings/account',
  SETTINGS_APPEARANCE: '/settings/appearance',
  HELP: '/help',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  TOKUSHOHO: '/tokushoho',
} as const

export const PROTECTED_PATHS: readonly string[] = [
  ROUTES.PAGES,
  ROUTES.SEARCH,
  ROUTES.SETTINGS,
  ROUTES.TRASH,
]

// 完全一致で判定する（/password-reset/confirm はリカバリーセッション中＝認証済みでも
// 表示する必要があるため、prefix 一致にしない）
export const AUTH_PATHS: readonly string[] = [ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.PASSWORD_RESET]
