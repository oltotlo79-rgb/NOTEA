'use client'

import { AlertCircle, Loader2 } from 'lucide-react'

type UploadingProps = {
  kind: 'uploading'
  progress?: number
}

type ErrorProps = {
  kind: 'error'
  message: string
  onRetry: () => void
  onDelete: () => void
}

type ImageUploadPlaceholderProps = UploadingProps | ErrorProps

export function ImageUploadPlaceholder(props: ImageUploadPlaceholderProps) {
  if (props.kind === 'uploading') {
    return (
      <div
        data-testid="image-upload-placeholder"
        className="flex h-32 flex-col items-center justify-center gap-2 rounded-md bg-muted"
        aria-label="画像をアップロード中"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">画像をアップロード中…</span>
        {props.progress !== undefined && (
          <div className="w-40" role="progressbar" aria-valuenow={props.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-1.5 rounded-full bg-muted-foreground/20">
              <div
                className="h-full rounded-full bg-muted-foreground transition-all duration-200"
                style={{ width: `${props.progress}%` }}
              />
            </div>
            <span className="sr-only">{props.progress}%</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="image-upload-error"
      className="flex h-32 flex-col items-center justify-center gap-2 rounded-md bg-muted"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
      <span className="text-sm text-destructive">{props.message}</span>
      <div className="flex gap-2">
        <button
          onClick={props.onRetry}
          data-testid="image-retry"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          再試行
        </button>
        <span className="text-sm text-muted-foreground" aria-hidden="true">·</span>
        <button
          onClick={props.onDelete}
          data-testid="image-delete"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          削除
        </button>
      </div>
    </div>
  )
}
