'use client'

/**
 * @module components/editor/ImageBlock
 * BlockNote の画像ブロック表示コンポーネント。
 * src に Supabase Storage のパスが入っている場合、署名付き閲覧URLに解決してから表示する。
 * 署名URLをコンテンツに保存せず path のみを保持することで期限切れを回避する。
 */
import { useImageUrl } from '@/hooks/use-image-url'
import { ImageUploadPlaceholder } from './ImageUploadPlaceholder'

type ImageBlockProps = {
  src: string
  caption: string
  onDelete: () => void
}

export function ImageBlockView({ src, caption, onDelete }: ImageBlockProps) {
  const { url, error } = useImageUrl(src)

  if (error) {
    return (
      <ImageUploadPlaceholder
        kind="error"
        message="画像を読み込めませんでした"
        onRetry={() => window.location.reload()}
        onDelete={onDelete}
      />
    )
  }

  if (!url) {
    return <ImageUploadPlaceholder kind="uploading" />
  }

  return (
    <figure className="my-1">
      {/* Supabase 署名URLはホストが動的（プロジェクト ID 含む）なため next/image の remotePatterns での管理より生 img が適切 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={caption || '画像'}
        width={800}
        height={600}
        className="max-w-full rounded-md"
        style={{ height: 'auto' }}
      />
      {caption && (
        <figcaption className="mt-1 text-sm text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
