'use client'

import { useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCheckoutSession, createPortalSession } from '@/lib/actions/billing'
import { BILLING_PLANS, PLAN_DISPLAY, type BillingPlan } from '@/lib/constants/billing'
import {
  PAID_MAX_STORAGE_GB,
  PAID_AI_DAILY_LIMIT,
} from '@/lib/constants/limits'

type PlanViewProps = {
  plan: 'free' | 'paid'
  periodEnd: string | null
}

export function PlanView({ plan, periodEnd }: PlanViewProps) {
  const [pending, setPending] = useState<BillingPlan | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async (selected: BillingPlan) => {
    setPending(selected)
    setError(null)
    const result = await createCheckoutSession({ plan: selected })
    if (result.success && result.data) {
      window.location.assign(result.data.url)
      return
    }
    setError(result.success ? null : result.error)
    setPending(null)
  }

  const handleManage = async () => {
    setPending('portal')
    setError(null)
    const result = await createPortalSession()
    if (result.success && result.data) {
      window.location.assign(result.data.url)
      return
    }
    setError(result.success ? null : result.error)
    setPending(null)
  }

  if (plan === 'paid') {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">プレミアムプラン 利用中</p>
          {periodEnd && (
            <p className="mt-1 text-xs text-muted-foreground">
              次回更新日: {new Date(periodEnd).toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>
        <Button onClick={handleManage} disabled={pending === 'portal'} variant="outline" className="gap-2 self-start">
          <ExternalLink className="size-4" />
          お支払い・解約の管理
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><Check className="size-4 text-primary" />ページ数 無制限</li>
        <li className="flex items-center gap-2"><Check className="size-4 text-primary" />ストレージ {PAID_MAX_STORAGE_GB}GB</li>
        <li className="flex items-center gap-2"><Check className="size-4 text-primary" />AI 1日{PAID_AI_DAILY_LIMIT}回・OpenAI / Anthropic も利用可</li>
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        {BILLING_PLANS.map((p) => {
          const display = PLAN_DISPLAY[p]
          return (
            <div key={p} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">{display.label}</span>
                {display.note && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{display.note}</span>
                )}
              </div>
              <p className="text-2xl font-bold">
                {display.price}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/ {display.period}</span>
              </p>
              <Button onClick={() => handleUpgrade(p)} disabled={pending === p} className="mt-1">
                {pending === p ? '準備中…' : 'このプランにする'}
              </Button>
            </div>
          )
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
