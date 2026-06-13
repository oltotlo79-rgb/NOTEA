'use client'

type PageErrorProps = {
  error: Error
  reset: () => void
  title?: string
}

export function PageError({ error, reset, title = 'エラーが発生しました' }: PageErrorProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        再試行
      </button>
    </div>
  )
}
