import { vi } from 'vitest'

type DbResult = { data: unknown; error: { message: string } | null }

export type MockSupabaseOptions = {
  user?: { id: string; email?: string } | null
  queryResult?: DbResult
  rpcResult?: DbResult
  authResult?: { error: { message: string } | null }
}

// from().select()...single()/maybeSingle() のチェーンと auth/rpc を持つ最小モック。
// メソッドは全て vi.fn なので呼び出し検証にも使える
export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'user-1', email: 'user@example.com' },
    queryResult = { data: null, error: null },
    rpcResult = { data: null, error: null },
    authResult = { error: null },
  } = options

  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit', 'lt'] as const
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(async () => queryResult)
  builder.maybeSingle = vi.fn(async () => queryResult)

  return {
    from: vi.fn(() => builder),
    rpc: vi.fn(async () => rpcResult),
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signUp: vi.fn(async () => authResult),
      signInWithPassword: vi.fn(async () => authResult),
      signOut: vi.fn(async () => authResult),
      resetPasswordForEmail: vi.fn(async () => authResult),
      updateUser: vi.fn(async () => authResult),
    },
    _builder: builder,
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
