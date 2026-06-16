import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpdateProfile = vi.fn()

vi.mock('@/lib/actions/profile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}))

import { ProfileForm } from '@/components/settings/ProfileForm'

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期表示名が入力欄に表示される', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    const input = screen.getByTestId('profile-display-name-input')
    expect(input).toHaveValue('田中 太郎')
  })

  it('メールアドレスが読み取り専用で表示される', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    const emailInput = screen.getByLabelText(/メールアドレス（変更不可）/)
    expect(emailInput).toHaveValue('user@example.com')
    expect(emailInput).toHaveAttribute('readonly')
  })

  it('保存ボタンが表示される', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    expect(screen.getByTestId('profile-save-button')).toBeInTheDocument()
  })

  it('空白のみの入力でバリデーションエラーが表示される', async () => {
    render(<ProfileForm initialDisplayName="" email="user@example.com" />)
    const saveBtn = screen.getByTestId('profile-save-button')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(screen.getByText('表示名を入力してください')).toBeInTheDocument()
    })
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('空白文字のみの入力でバリデーションエラーが表示される', async () => {
    render(<ProfileForm initialDisplayName="   " email="user@example.com" />)
    const saveBtn = screen.getByTestId('profile-save-button')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(screen.getByText('表示名を入力してください')).toBeInTheDocument()
    })
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('50文字を超える入力でバリデーションエラーが表示される', async () => {
    render(<ProfileForm initialDisplayName={'a'.repeat(51)} email="user@example.com" />)
    const saveBtn = screen.getByTestId('profile-save-button')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(screen.getByText('50文字以内で入力してください')).toBeInTheDocument()
    })
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('正常な入力で updateProfile が呼ばれる', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: true })
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    const saveBtn = screen.getByTestId('profile-save-button')
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: '田中 太郎' })
    })
  })

  it('成功時に「プロフィールを保存しました」が表示される', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: true })
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    fireEvent.click(screen.getByTestId('profile-save-button'))
    await waitFor(() => {
      expect(screen.getByText('プロフィールを保存しました')).toBeInTheDocument()
    })
  })

  it('失敗時に保存失敗メッセージが表示される', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: false, error: 'server error' })
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    fireEvent.click(screen.getByTestId('profile-save-button'))
    await waitFor(() => {
      expect(screen.getByText('保存に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })
  })

  it('入力欄の変更で成功メッセージがリセットされる', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: true })
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    fireEvent.click(screen.getByTestId('profile-save-button'))
    await waitFor(() => {
      expect(screen.getByText('プロフィールを保存しました')).toBeInTheDocument()
    })
    // 入力を変更すると成功メッセージが消える
    const input = screen.getByTestId('profile-display-name-input')
    fireEvent.change(input, { target: { value: '新しい名前' } })
    expect(screen.queryByText('プロフィールを保存しました')).not.toBeInTheDocument()
  })

  it('表示名ラベルが存在する', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    expect(screen.getByText('表示名')).toBeInTheDocument()
  })

  it('ヒントテキスト「50 文字まで」が表示される', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    expect(screen.getByText(/50 文字まで/)).toBeInTheDocument()
  })

  it('メールアドレスの変更不可の説明文が表示される', () => {
    render(<ProfileForm initialDisplayName="田中 太郎" email="user@example.com" />)
    expect(screen.getByText('メールアドレスの変更は現在サポートされていません。')).toBeInTheDocument()
  })

  it('入力欄の初期値が空のとき保存時にバリデーションエラー', async () => {
    render(<ProfileForm initialDisplayName="" email="user@example.com" />)
    fireEvent.click(screen.getByTestId('profile-save-button'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
