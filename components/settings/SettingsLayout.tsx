import { SettingsNavClient } from './SettingsNavClient'

type SettingsLayoutProps = {
  children: React.ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex h-full">
      {/* 設定ナビ: デスクトップのみ表示 */}
      <div className="hidden md:flex flex-col w-[200px] border-r border-border shrink-0 px-3 py-6">
        <SettingsNavClient />
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
