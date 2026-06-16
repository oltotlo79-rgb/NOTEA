import { vi } from 'vitest'

type DbResult = { data: unknown; error: { message: string } | null }

export type MockSupabaseOptions = {
  user?: { id: string; email?: string } | null
  queryResult?: DbResult
  listResult?: DbResult
  rpcResult?: DbResult
  authResult?: { error: { message: string } | null }
}

/**
 * @module __tests__/utils/test-utils
 * Supabase クライアントのテスト用モック。
 *
 * 設計方針:
 * - from() は毎回同じ builder インスタンスを返す（vi.fn の呼び出し検証のため）
 * - builder は thenable（Promise-like）なので await chain-end が動作する
 * - _single / _maybeSingle / _rpc は mockResolvedValueOnce で per-call override 可能
 * - _builder.then を書き換えることで chain-end（update/delete 等）の戻り値を制御できる
 * - 後方互換: queryResult / rpcResult / user / authResult は従来通り動作する
 */
export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'user-1', email: 'user@example.com' },
    queryResult = { data: null, error: null },
    listResult = { data: [], error: null },
    rpcResult = { data: null, error: null },
    authResult = { error: null },
  } = options

  // currentResult はテストから変更可能なポインタ。builder.then がこれを参照する。
  const defaultResult = { current: queryResult as DbResult }

  const _single = vi.fn(async () => queryResult)
  const _maybeSingle = vi.fn(async () => queryResult)
  const _list = vi.fn(async () => listResult)

  // builder を thenable にして `await chain-end` が動作するようにする。
  // then() を書き換えることで特定テストの chain-end 結果を変更できる。
  const builder: Record<string, unknown> = {}

  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'is',
    'in',
    'lt',
    'lte',
    'gt',
    'gte',
    'order',
    'limit',
    'filter',
    'or',
    'textSearch',
  ] as const

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }

  builder.single = _single
  builder.maybeSingle = _maybeSingle

  // await builder（chain 末尾で await した場合）は defaultResult.current を返す
  builder.then = (
    resolve: (value: DbResult) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve(defaultResult.current).then(resolve, reject)

  // Storage モック: list/remove/createSignedUploadUrl を per-call override 可能にする
  // vi.fn の型引数を明示して mockResolvedValueOnce の型検査が通るようにする
  type StorageFileEntry = { name: string; metadata?: Record<string, unknown> | null }
  type StorageListResult = { data: StorageFileEntry[] | null; error: { message: string } | null }
  type StorageRemoveResult = { data: unknown; error: { message: string } | null }
  type StorageUploadResult = { data: unknown; error: { message: string } | null }
  type StorageSignedUploadResult = {
    data: { path: string; token: string; signedUrl: string } | null
    error: { message: string } | null
  }

  const storageBucketBuilder = {
    list: vi.fn<() => Promise<StorageListResult>>(async () => ({ data: [], error: null })),
    remove: vi.fn<() => Promise<StorageRemoveResult>>(async () => ({ data: null, error: null })),
    upload: vi.fn<() => Promise<StorageUploadResult>>(async () => ({ data: null, error: null })),
    createSignedUploadUrl: vi.fn<() => Promise<StorageSignedUploadResult>>(async () => ({
      data: { path: 'user-1/page-1/uuid.webp', token: 'signed-token', signedUrl: 'https://example.com/upload' },
      error: null,
    })),
  }
  const storageMock = {
    from: vi.fn(() => storageBucketBuilder),
    _bucket: storageBucketBuilder,
  }

  const rpcFn = vi.fn(async () => rpcResult)

  return {
    from: vi.fn(() => builder),
    rpc: rpcFn,
    storage: storageMock,
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signUp: vi.fn(async () => authResult),
      signInWithPassword: vi.fn(async () => authResult),
      signOut: vi.fn(async () => authResult),
      resetPasswordForEmail: vi.fn(async () => authResult),
      updateUser: vi.fn(async () => authResult),
    },
    // per-call override と引数検証用に公開
    _builder: builder,
    _single,
    _maybeSingle,
    _list,
    _storage: storageMock,
    _rpc: rpcFn,
    // chain-end の結果を変更するためのポインタ
    _defaultResult: defaultResult,
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
