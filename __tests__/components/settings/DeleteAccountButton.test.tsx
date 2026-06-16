import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDeleteAccount = vi.fn()
const mockSignOut = vi.fn(async () => ({ error: null }))
const mockRouterPush = vi.fn()

vi.mock('@/lib/actions/profile', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: () => mockSignOut(),
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

import { DeleteAccountButton } from '@/components/settings/DeleteAccountButton'

describe('DeleteAccountButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('削除ボタン（ページ上）が表示される', () => {
    render(<DeleteAccountButton />)
    expect(screen.getByTestId('account-delete-open-dialog')).toBeInTheDocument()
  })

  it('削除ボタンをクリックするとダイアログが開く', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-dialog')).toBeInTheDocument()
    })
  })

  it('ダイアログに「アカウントを削除しますか？」のタイトルが表示される', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByText('アカウントを削除しますか？')).toBeInTheDocument()
    })
  })

  it('確認テキスト入力欄が表示される', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
  })

  it('確認テキスト未入力では削除実行ボタンが disabled', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      const submitBtn = screen.getByTestId('account-delete-submit')
      expect(submitBtn).toBeDisabled()
    })
  })

  it('誤ったテキスト入力では削除実行ボタンが disabled のまま', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('account-delete-confirm-input')
    fireEvent.change(input, { target: { value: 'wrong text' } })
    expect(screen.getByTestId('account-delete-submit')).toBeDisabled()
  })

  it('正確な確認テキスト入力でボタンが活性化する', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('account-delete-confirm-input')
    fireEvent.change(input, { target: { value: 'delete my account' } })
    expect(screen.getByTestId('account-delete-submit')).not.toBeDisabled()
  })

  it('削除成功後に signOut が呼ばれる', async () => {
    mockDeleteAccount.mockResolvedValueOnce({ success: true })
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('account-delete-confirm-input')
    fireEvent.change(input, { target: { value: 'delete my account' } })
    fireEvent.click(screen.getByTestId('account-delete-submit'))
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith({ confirmation: 'delete my account' })
    })
  })

  it('削除失敗時にエラーメッセージが表示される', async () => {
    mockDeleteAccount.mockResolvedValueOnce({ success: false, error: 'failed' })
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('account-delete-confirm-input')
    fireEvent.change(input, { target: { value: 'delete my account' } })
    fireEvent.click(screen.getByTestId('account-delete-submit'))
    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })
  })

  it('ダイアログに削除対象一覧が表示される', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByText('すべてのページとその内容')).toBeInTheDocument()
      expect(screen.getByText('アップロードした画像')).toBeInTheDocument()
      expect(screen.getByText(/AI キー/)).toBeInTheDocument()
      expect(screen.getByText('アカウント情報')).toBeInTheDocument()
    })
  })

  it('キャンセルボタンが存在する', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
    })
  })

  it('確認テキスト入力をリセットするとボタンが再び disabled になる', async () => {
    render(<DeleteAccountButton />)
    fireEvent.click(screen.getByTestId('account-delete-open-dialog'))
    await waitFor(() => {
      expect(screen.getByTestId('account-delete-confirm-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('account-delete-confirm-input')
    fireEvent.change(input, { target: { value: 'delete my account' } })
    expect(screen.getByTestId('account-delete-submit')).not.toBeDisabled()
    fireEvent.change(input, { target: { value: 'delete my accoun' } })
    expect(screen.getByTestId('account-delete-submit')).toBeDisabled()
  })
})
