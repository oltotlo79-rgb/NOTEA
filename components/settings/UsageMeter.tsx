type UsageMeterProps = {
  label: string
  used: number
  limit: number
  unit: string
  formattedUsed: string
  formattedLimit: string
  planLabel: string
  testId?: string
}

const WARNING_THRESHOLD_PERCENT = 80

export function UsageMeter({
  label,
  used,
  limit,
  unit,
  formattedUsed,
  formattedLimit,
  planLabel,
  testId,
}: UsageMeterProps) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isWarning = percent >= WARNING_THRESHOLD_PERCENT

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {formattedUsed} / {formattedLimit} {unit}（{planLabel}）
        </span>
        <span className="text-muted-foreground text-xs">{Math.round(percent)}%</span>
      </div>

      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${formattedUsed} / ${formattedLimit} ${unit}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isWarning ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
