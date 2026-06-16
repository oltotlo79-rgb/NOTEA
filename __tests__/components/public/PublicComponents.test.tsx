import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    render: renderProp,
    ...props
  }: {
    children?: React.ReactNode
    render?: React.ReactElement
    [key: string]: unknown
  }) => {
    if (renderProp) {
      const element = renderProp as React.ReactElement<{
        children?: React.ReactNode
        [key: string]: unknown
      }>
      return <element.type {...element.props}>{children}</element.type>
    }
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

import { LandingHero } from '@/components/public/LandingHero'
import { PublicNav } from '@/components/public/PublicNav'
import { PublicFooter } from '@/components/public/PublicFooter'
import { FeatureCards } from '@/components/public/FeatureCards'
import { BYOKExplainer } from '@/components/public/BYOKExplainer'
import { PricingSection } from '@/components/public/PricingSection'

describe('LandingHero', () => {
  it('ヒーローの h1 が表示される', () => {
    render(<LandingHero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('思考を整理する')
  })

  it('「無料で始める」CTA ボタンが表示される', () => {
    render(<LandingHero />)
    expect(screen.getByTestId('lp-cta-register')).toBeInTheDocument()
  })

  it('「ログイン」CTA ボタンが表示される', () => {
    render(<LandingHero />)
    expect(screen.getByTestId('lp-cta-login')).toBeInTheDocument()
  })

  it('BYOK の説明文が表示される', () => {
    render(<LandingHero />)
    expect(screen.getByText(/鍵を預からない/)).toBeInTheDocument()
  })
})

describe('PublicNav', () => {
  it('「Notea」ロゴが表示される', () => {
    render(<PublicNav />)
    expect(screen.getByText('Notea')).toBeInTheDocument()
  })

  it('「ログイン」テキストが存在する', () => {
    render(<PublicNav />)
    expect(screen.getByText('ログイン')).toBeInTheDocument()
  })

  it('「無料で始める」テキストが存在する', () => {
    render(<PublicNav />)
    expect(screen.getByText('無料で始める')).toBeInTheDocument()
  })

  it('ヘッダー要素が描画される', () => {
    render(<PublicNav />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})

describe('PublicFooter', () => {
  it('「Notea」のブランド名が表示される', () => {
    render(<PublicFooter />)
    expect(screen.getByText('Notea')).toBeInTheDocument()
  })

  it('「利用規約」リンクが存在する', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: '利用規約' })).toBeInTheDocument()
  })

  it('「プライバシーポリシー」リンクが存在する', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toBeInTheDocument()
  })

  it('「特定商取引法」リンクが存在する', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: /特定商取引法/ })).toBeInTheDocument()
  })

  it('「ヘルプ」リンクが存在する', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: 'ヘルプ' })).toBeInTheDocument()
  })

  it('フッター要素が描画される', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})

describe('FeatureCards', () => {
  it('ブロックエディタカードが表示される', () => {
    render(<FeatureCards />)
    expect(screen.getByText('ブロックエディタ')).toBeInTheDocument()
  })

  it('BYOK AI カードが表示される', () => {
    render(<FeatureCards />)
    expect(screen.getByText('BYOK AI')).toBeInTheDocument()
  })

  it('ページツリーカードが表示される', () => {
    render(<FeatureCards />)
    expect(screen.getByText('ページツリー')).toBeInTheDocument()
  })

  it('機能説明文が表示される', () => {
    render(<FeatureCards />)
    expect(screen.getByText(/Notion 風のリッチな編集環境/)).toBeInTheDocument()
  })
})

describe('BYOKExplainer', () => {
  it('見出しが表示される', () => {
    render(<BYOKExplainer />)
    expect(screen.getByRole('heading')).toHaveTextContent('AI はあなた自身のキーで動きます')
  })

  it('「サーバーに渡りません」の説明が含まれる', () => {
    render(<BYOKExplainer />)
    expect(screen.getByText(/サーバーに渡りません/)).toBeInTheDocument()
  })

  it('費用説明が含まれる', () => {
    render(<BYOKExplainer />)
    expect(screen.getByText(/上乗せはありません/)).toBeInTheDocument()
  })

  it('無料プランの記述が含まれる', () => {
    render(<BYOKExplainer />)
    expect(screen.getByText(/無料プランでは Google Gemini/)).toBeInTheDocument()
  })
})

describe('PricingSection', () => {
  it('無料プランカードが表示される', () => {
    render(<PricingSection />)
    expect(screen.getByText('無料')).toBeInTheDocument()
  })

  it('プレミアムプランカードが表示される', () => {
    render(<PricingSection />)
    expect(screen.getByText('プレミアム')).toBeInTheDocument()
  })

  it('「無料で始める」CTA ボタンが存在する', () => {
    render(<PricingSection />)
    expect(screen.getByTestId('pricing-free-cta')).toBeInTheDocument()
  })

  it('無料プランの制限が表示される', () => {
    render(<PricingSection />)
    expect(screen.getByText(/ページ 100 まで/)).toBeInTheDocument()
  })

  it('有料プランの補足「第2弾リリース予定」が表示される', () => {
    render(<PricingSection />)
    expect(screen.getByText(/第2弾リリース予定/)).toBeInTheDocument()
  })
})
