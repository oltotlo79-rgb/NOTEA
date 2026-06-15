'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { useSidebarState } from '@/hooks/use-sidebar-state'
import { cn } from '@/lib/utils'
import { AutoSaveProvider, useAutoSaveContext } from '@/components/editor/AutoSaveContext'
import { AutoSaveStatus } from '@/components/editor/AutoSaveStatus'
import { AiUsageBadge } from '@/components/ai/AiUsageBadge'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'

const SIDEBAR_WIDTH = 260

type AppShellProps = {
  children: React.ReactNode
  userEmail: string | undefined
}

function AppShellInner({ children, userEmail }: AppShellProps) {
  const { isSidebarCollapsed, toggleSidebar } = useSidebarState()
  const autoSaveCtx = useAutoSaveContext()

  useGlobalShortcuts({ onToggleSidebar: toggleSidebar })

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* デスクトップ: 固定幅サイドバー */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border shrink-0 overflow-hidden transition-all duration-200'
        )}
        style={{ width: isSidebarCollapsed ? 0 : SIDEBAR_WIDTH }}
      >
        <Sidebar userEmail={userEmail} />
      </aside>

      {/* メインコンテンツ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* スキップリンク: フォーカス時のみ表示 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-background focus:border focus:border-border focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
          data-testid="skip-to-main"
        >
          メインコンテンツへスキップ
        </a>

        {/* トップバー */}
        <header className="flex h-10 items-center gap-2 border-b border-border px-3 md:px-4 shrink-0">
          {/* デスクトップ: サイドバー折りたたみボタン */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleSidebar}
            aria-label="サイドバーを切り替え"
            className="hidden md:inline-flex"
          >
            <Menu className="size-4" />
          </Button>

          {/* モバイル: Sheet でサイドバーをドロワー表示 */}
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="md:hidden"
                  aria-label="サイドバーを開く"
                />
              }
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[260px] sm:w-[260px]">
              <SheetHeader className="sr-only">
                <SheetTitle>ナビゲーション</SheetTitle>
              </SheetHeader>
              <Sidebar userEmail={userEmail} />
            </SheetContent>
          </Sheet>

          {/* 右端: AI残回数バッジ + 自動保存ステータス（エディタページでのみ表示） */}
          <div className="ml-auto flex items-center gap-3">
            {autoSaveCtx && <AiUsageBadge />}
            {autoSaveCtx && (
              <AutoSaveStatus status={autoSaveCtx.status} onRetry={autoSaveCtx.onRetry} />
            )}
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <AutoSaveProvider>
      <AppShellInner userEmail={userEmail}>{children}</AppShellInner>
    </AutoSaveProvider>
  )
}
