export const SEARCH_PAGE_SIZE = 20
export const MAX_SEARCH_QUERY_LENGTH = 100
// スニペット文字数。前後の文脈を含む一致箇所抜粋、またはヒットなし時は先頭 N 文字
export const SNIPPET_LENGTH = 120
// スニペット抜粋時に一致箇所の前後に付ける余白文字数
export const SNIPPET_CONTEXT = 40
// 検索ボックス入力の debounce（ms）。打鍵ごとに action を呼ばない
export const SEARCH_DEBOUNCE_MS = 300
