// 3 箇所以上で同じ形になる select 文字列を集約。純粋な文字列定数のため
// actions / services / queries 双方から依存方向中立に import 可能
export const PAGE_LIST_SELECT = 'id, parent_id, title, icon, sort_order'
export const PAGE_DETAIL_SELECT =
  'id, parent_id, title, icon, content, content_text, updated_at, is_trashed'
