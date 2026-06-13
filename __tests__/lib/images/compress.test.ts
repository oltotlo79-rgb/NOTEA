/**
 * @module __tests__/lib/images/compress.test.ts
 * lib/images/compress.ts のユニットテスト。
 * jsdom は Canvas/OffscreenCanvas 未対応のため vi.stubGlobal でモックする。
 * OffscreenCanvas は new で呼ばれるためクラスとして stubGlobal に渡す。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_IMAGE_INPUT_SIZE_MB, MAX_IMAGE_STORED_SIZE_MB, IMAGE_MAX_DIMENSION } from '@/lib/constants/limits'

// ---- OffscreenCanvas コンストラクタモック ----

// 各テストで OffscreenCanvas インスタンスにアクセスできるよう、
// 直近に生成されたモックインスタンスを格納する変数
type MockCanvasInstance = {
  drawImage: ReturnType<typeof vi.fn>
  convertToBlob: ReturnType<typeof vi.fn>
  getContext: ReturnType<typeof vi.fn>
  width: number
  height: number
}
let lastCanvas: MockCanvasInstance | null = null

// コンストラクタ内で this を外部変数に代入する代わりに、
// ファクトリ関数で作成したオブジェクトをクラス内から参照する。
// setLastCanvas コールバックで外部への登録を行い、no-this-alias を回避する。
function createOffscreenCanvasClass(blobSizeBytes = 1024) {
  return class MockOffscreenCanvas {
    public width: number
    public height: number
    public drawImage: ReturnType<typeof vi.fn>
    public convertToBlob: ReturnType<typeof vi.fn>
    public getContext: ReturnType<typeof vi.fn>

    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      const drawImage = vi.fn()
      this.drawImage = drawImage
      this.convertToBlob = vi.fn(async () => new Blob(['x'.repeat(blobSizeBytes)], { type: 'image/webp' }))
      this.getContext = vi.fn(() => ({ drawImage }))
      // 外部参照として登録（インスタンス自体を型経由で渡す）
      lastCanvas = { width: this.width, height: this.height, drawImage, convertToBlob: this.convertToBlob, getContext: this.getContext }
    }
  }
}

// getContext が null を返すクラス
class MockOffscreenCanvasNullCtx {
  public width: number
  public height: number
  public getContext: ReturnType<typeof vi.fn>
  public convertToBlob: ReturnType<typeof vi.fn>

  constructor(w: number, h: number) {
    this.width = w
    this.height = h
    this.getContext = vi.fn(() => null)
    this.convertToBlob = vi.fn()
    lastCanvas = { width: this.width, height: this.height, drawImage: vi.fn(), convertToBlob: this.convertToBlob, getContext: this.getContext }
  }
}

let mockBitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> }

function setupMocks(bitmapW = 800, bitmapH = 600, blobSizeBytes = 1024) {
  mockBitmap = { width: bitmapW, height: bitmapH, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap))
  vi.stubGlobal('OffscreenCanvas', createOffscreenCanvasClass(blobSizeBytes))
}

function teardownMocks() {
  vi.unstubAllGlobals()
  lastCanvas = null
}

// ---- ファイル生成ヘルパー ----

function makeJpegFile(sizeBytes = 100, name = 'test.jpg'): File {
  const magic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
  const rest = new Uint8Array(Math.max(0, sizeBytes - magic.length))
  const buf = new Uint8Array(magic.length + rest.length)
  buf.set(magic, 0)
  buf.set(rest, magic.length)
  return new File([buf], name, { type: 'image/jpeg' })
}

function makePngFile(sizeBytes = 100, name = 'test.png'): File {
  const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const rest = new Uint8Array(Math.max(0, sizeBytes - magic.length))
  const buf = new Uint8Array(magic.length + rest.length)
  buf.set(magic, 0)
  buf.set(rest, magic.length)
  return new File([buf], name, { type: 'image/png' })
}

function makeWebpFile(sizeBytes = 100, name = 'test.webp'): File {
  const magic = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
  const rest = new Uint8Array(Math.max(0, sizeBytes - magic.length))
  const buf = new Uint8Array(magic.length + rest.length)
  buf.set(magic, 0)
  buf.set(rest, magic.length)
  return new File([buf], name, { type: 'image/webp' })
}

function makeGifFile(sizeBytes = 100, name = 'test.gif'): File {
  const magic = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])
  const rest = new Uint8Array(Math.max(0, sizeBytes - magic.length))
  const buf = new Uint8Array(magic.length + rest.length)
  buf.set(magic, 0)
  buf.set(rest, magic.length)
  return new File([buf], name, { type: 'image/gif' })
}

function makeInvalidMagicJpegFile(name = 'bad.jpg'): File {
  const badBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])
  return new File([badBytes], name, { type: 'image/jpeg' })
}

// ---- テスト ----

describe('compressImage', () => {
  afterEach(() => {
    teardownMocks()
  })

  // =====================
  // 正常系
  // =====================
  describe('正常系', () => {
    beforeEach(() => {
      setupMocks(800, 600, 512)
    })

    it('JPEG ファイルを圧縮して Blob を返す', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      const blob = await compressImage(file)
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/webp')
    })

    it('PNG ファイルを圧縮して Blob を返す', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makePngFile()
      const blob = await compressImage(file)
      expect(blob).toBeInstanceOf(Blob)
    })

    it('WebP ファイルを圧縮して Blob を返す', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeWebpFile()
      const blob = await compressImage(file)
      expect(blob).toBeInstanceOf(Blob)
    })

    it('圧縮後に bitmap.close() が呼ばれる', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await compressImage(file)
      expect(mockBitmap.close).toHaveBeenCalledOnce()
    })

    it('OffscreenCanvas の convertToBlob に image/webp と品質を渡す', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await compressImage(file)
      expect(lastCanvas?.convertToBlob).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'image/webp', quality: expect.any(Number) })
      )
    })
  })

  // =====================
  // 縮小ロジック
  // =====================
  describe('縮小ロジック（長辺 2048 以下への縮小）', () => {
    it('長辺が IMAGE_MAX_DIMENSION 以内の画像はそのままのサイズで OffscreenCanvas を作成する', async () => {
      setupMocks(1000, 800)
      const { compressImage } = await import('@/lib/images/compress')
      await compressImage(makeJpegFile())
      expect(lastCanvas?.width).toBe(1000)
      expect(lastCanvas?.height).toBe(800)
    })

    it('横長画像（幅 4096, 高さ 2000）を長辺 2048 に縮小する', async () => {
      setupMocks(4096, 2000)
      const { compressImage } = await import('@/lib/images/compress')
      await compressImage(makeJpegFile())

      const scale = IMAGE_MAX_DIMENSION / 4096
      const expectedW = Math.round(4096 * scale)
      const expectedH = Math.round(2000 * scale)
      expect(lastCanvas?.width).toBe(expectedW)
      expect(lastCanvas?.height).toBe(expectedH)
    })

    it('縦長画像（幅 1000, 高さ 4000）を長辺 2048 に縮小する', async () => {
      setupMocks(1000, 4000)
      const { compressImage } = await import('@/lib/images/compress')
      await compressImage(makeJpegFile())

      const scale = IMAGE_MAX_DIMENSION / 4000
      const expectedW = Math.round(1000 * scale)
      const expectedH = Math.round(4000 * scale)
      expect(lastCanvas?.width).toBe(expectedW)
      expect(lastCanvas?.height).toBe(expectedH)
    })

    it('ちょうど 2048x2048 の画像はリサイズしない', async () => {
      setupMocks(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION)
      const { compressImage } = await import('@/lib/images/compress')
      await compressImage(makeJpegFile())
      expect(lastCanvas?.width).toBe(IMAGE_MAX_DIMENSION)
      expect(lastCanvas?.height).toBe(IMAGE_MAX_DIMENSION)
    })
  })

  // =====================
  // 入力サイズ制限
  // =====================
  describe('入力サイズ制限', () => {
    beforeEach(() => {
      setupMocks()
    })

    it(`原画 ${MAX_IMAGE_INPUT_SIZE_MB}MB 超のファイルは input_too_large エラー`, async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const overSize = MAX_IMAGE_INPUT_SIZE_MB * 1024 * 1024 + 1
      const file = makeJpegFile(overSize)
      await expect(compressImage(file)).rejects.toMatchObject({
        kind: 'input_too_large',
        maxMb: MAX_IMAGE_INPUT_SIZE_MB,
      })
    })

    it(`原画 ${MAX_IMAGE_INPUT_SIZE_MB}MB ちょうどは許可される`, async () => {
      const { compressImage } = await import('@/lib/images/compress')
      // setupMocks の blobSizeBytes を MAX_IMAGE_INPUT_SIZE_MB と同じにしないことに注意
      // 入力チェックのみテストする（出力は 1024 バイトのモック）
      const exactSize = MAX_IMAGE_INPUT_SIZE_MB * 1024 * 1024
      const file = makeJpegFile(exactSize)
      await expect(compressImage(file)).resolves.toBeInstanceOf(Blob)
    })
  })

  // =====================
  // 出力サイズ制限
  // =====================
  describe('出力サイズ制限', () => {
    it(`圧縮後 ${MAX_IMAGE_STORED_SIZE_MB}MB 超は output_too_large エラー`, async () => {
      const overOutputBytes = MAX_IMAGE_STORED_SIZE_MB * 1024 * 1024 + 1
      setupMocks(800, 600, overOutputBytes)
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await expect(compressImage(file)).rejects.toMatchObject({
        kind: 'output_too_large',
        maxMb: MAX_IMAGE_STORED_SIZE_MB,
      })
    })

    it(`圧縮後 ${MAX_IMAGE_STORED_SIZE_MB}MB ちょうどは許可される`, async () => {
      const exactOutputBytes = MAX_IMAGE_STORED_SIZE_MB * 1024 * 1024
      setupMocks(800, 600, exactOutputBytes)
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await expect(compressImage(file)).resolves.toBeInstanceOf(Blob)
    })
  })

  // =====================
  // 形式拒否
  // =====================
  describe('形式拒否', () => {
    beforeEach(() => {
      setupMocks()
    })

    it('GIF ファイル（MIME: image/gif）は unsupported_type エラー', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeGifFile()
      await expect(compressImage(file)).rejects.toMatchObject({ kind: 'unsupported_type' })
    })

    it('MIME は image/jpeg だがマジックバイト不一致のファイルは unsupported_type エラー', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeInvalidMagicJpegFile()
      await expect(compressImage(file)).rejects.toMatchObject({ kind: 'unsupported_type' })
    })

    it('MIME が空のファイルは unsupported_type エラー', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = new File([new Uint8Array(12)], 'test.txt', { type: '' })
      await expect(compressImage(file)).rejects.toMatchObject({ kind: 'unsupported_type' })
    })

    it('text/plain MIME のファイルは unsupported_type エラー', async () => {
      const { compressImage } = await import('@/lib/images/compress')
      const file = new File([new Uint8Array(12)], 'test.txt', { type: 'text/plain' })
      await expect(compressImage(file)).rejects.toMatchObject({ kind: 'unsupported_type' })
    })
  })

  // =====================
  // createImageBitmap 失敗
  // =====================
  describe('createImageBitmap 失敗', () => {
    it('createImageBitmap が例外を投げたら compress_failed エラー', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed') }))
      vi.stubGlobal('OffscreenCanvas', createOffscreenCanvasClass())
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await expect(compressImage(file)).rejects.toMatchObject({
        kind: 'compress_failed',
        message: 'decode failed',
      })
    })

    it('createImageBitmap が非 Error を投げたらデフォルトメッセージを持つ compress_failed エラー', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw 'string error' }))
      vi.stubGlobal('OffscreenCanvas', createOffscreenCanvasClass())
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await expect(compressImage(file)).rejects.toMatchObject({
        kind: 'compress_failed',
      })
    })
  })

  // =====================
  // OffscreenCanvas context 取得失敗
  // =====================
  describe('OffscreenCanvas context 取得失敗', () => {
    it('getContext が null を返したら compress_failed エラー', async () => {
      vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })))
      vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvasNullCtx)
      const { compressImage } = await import('@/lib/images/compress')
      const file = makeJpegFile()
      await expect(compressImage(file)).rejects.toMatchObject({
        kind: 'compress_failed',
        message: expect.stringContaining('Canvas'),
      })
    })
  })
})
