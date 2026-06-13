/**
 * @module lib/images/compress
 * ブラウザ専用の画像圧縮モジュール。Canvas/OffscreenCanvas を使い、
 * 長辺を IMAGE_MAX_DIMENSION 以内に縮小して WebP に変換する。
 * サーバーモジュール（lib/supabase/server 等）を import しない。
 * AI キー・認証情報と無関係。
 */
import { IMAGE_MAX_DIMENSION, IMAGE_WEBP_QUALITY, MAX_IMAGE_INPUT_SIZE_MB, MAX_IMAGE_STORED_SIZE_MB } from '@/lib/constants/limits'

export type CompressError =
  | { kind: 'unsupported_type' }
  | { kind: 'input_too_large'; maxMb: number }
  | { kind: 'output_too_large'; maxMb: number }
  | { kind: 'compress_failed'; message: string }

// JPEG / PNG / WebP のマジックバイト
const MAGIC_BYTES: ReadonlyArray<{ mime: string; bytes: number[]; offset: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  // WebP: "RIFF" + 4バイト + "WEBP"
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
]

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function detectMimeType(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  for (const { mime, bytes: magic, offset } of MAGIC_BYTES) {
    if (magic.every((b, i) => bytes[offset + i] === b)) {
      // WebP の場合、offset 8〜11 が "WEBP" かも確認する
      if (mime === 'image/webp') {
        const webpMarker = [0x57, 0x45, 0x42, 0x50]
        if (webpMarker.every((b, i) => bytes[8 + i] === b)) {
          return mime
        }
        continue
      }
      return mime
    }
  }
  return null
}

/**
 * ファイルを検証し、長辺 IMAGE_MAX_DIMENSION に縮小して WebP に変換して返す。
 * 失敗時は CompressError を reject する。
 */
export async function compressImage(file: File): Promise<Blob> {
  const maxInputBytes = MAX_IMAGE_INPUT_SIZE_MB * 1024 * 1024
  if (file.size > maxInputBytes) {
    return Promise.reject<Blob>({
      kind: 'input_too_large',
      maxMb: MAX_IMAGE_INPUT_SIZE_MB,
    } satisfies CompressError)
  }

  // MIME チェック: MIME 属性 + マジックバイト両方を確認する
  if (!SUPPORTED_MIMES.has(file.type)) {
    return Promise.reject<Blob>({ kind: 'unsupported_type' } satisfies CompressError)
  }

  const detectedMime = await detectMimeType(file)
  if (!detectedMime) {
    return Promise.reject<Blob>({ kind: 'unsupported_type' } satisfies CompressError)
  }

  const bitmap = await createImageBitmap(file).catch((e: unknown) => {
    const message = e instanceof Error ? e.message : '画像の読み込みに失敗しました'
    return Promise.reject<ImageBitmap>({ kind: 'compress_failed', message } satisfies CompressError)
  })

  const { width: origW, height: origH } = bitmap
  const longest = Math.max(origW, origH)

  let drawW = origW
  let drawH = origH

  if (longest > IMAGE_MAX_DIMENSION) {
    const scale = IMAGE_MAX_DIMENSION / longest
    drawW = Math.round(origW * scale)
    drawH = Math.round(origH * scale)
  }

  const quality = IMAGE_WEBP_QUALITY / 100

  // OffscreenCanvas が利用できる環境ではそちらを優先する（Web Worker でも動作する）
  let blob: Blob | null = null

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(drawW, drawH)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return Promise.reject<Blob>({
        kind: 'compress_failed',
        message: 'Canvas コンテキストを取得できませんでした',
      } satisfies CompressError)
    }
    ctx.drawImage(bitmap, 0, 0, drawW, drawH)
    blob = await canvas.convertToBlob({ type: 'image/webp', quality })
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = drawW
    canvas.height = drawH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return Promise.reject<Blob>({
        kind: 'compress_failed',
        message: 'Canvas コンテキストを取得できませんでした',
      } satisfies CompressError)
    }
    ctx.drawImage(bitmap, 0, 0, drawW, drawH)

    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', quality)
    })
  }

  bitmap.close()

  if (!blob) {
    return Promise.reject<Blob>({
      kind: 'compress_failed',
      message: 'WebP への変換に失敗しました',
    } satisfies CompressError)
  }

  const maxStoredBytes = MAX_IMAGE_STORED_SIZE_MB * 1024 * 1024
  if (blob.size > maxStoredBytes) {
    return Promise.reject<Blob>({
      kind: 'output_too_large',
      maxMb: MAX_IMAGE_STORED_SIZE_MB,
    } satisfies CompressError)
  }

  return blob
}
