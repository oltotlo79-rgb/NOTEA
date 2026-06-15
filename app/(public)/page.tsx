import type { Metadata } from 'next'
import { LandingHero } from '@/components/public/LandingHero'
import { FeatureCards } from '@/components/public/FeatureCards'
import { BYOKExplainer } from '@/components/public/BYOKExplainer'
import { PricingSection } from '@/components/public/PricingSection'

// 本番 CSP nonce が per-request で変わるため、静的プリレンダではスクリプトがブロックされる。
// force-dynamic でランタイムレンダリングに固定し、proxy が付与する nonce を script に適用させる。
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notea — Notion 風メモアプリ（BYOK AI）',
  description: 'ブロックエディタ × BYOK AI のメモアプリ。あなた自身の API キーで AI を使え、キーは Notea に渡りません。',
  openGraph: {
    title: 'Notea — Notion 風メモアプリ（BYOK AI）',
    description: 'ブロックエディタ × BYOK AI のメモアプリ。あなた自身の API キーで AI を使え、キーは Notea に渡りません。',
    type: 'website',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://notea.app/',
  },
}

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <FeatureCards />
      <BYOKExplainer />
      <PricingSection />
    </>
  )
}
