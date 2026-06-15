import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ヘルプ | Notea',
  description: 'Notea の AI キー取得方法・BYOK の説明・よくある質問をご覧ください。',
}

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">ヘルプ</h1>

      {/* 目次 */}
      <nav aria-label="目次">
        <ol className="text-sm text-muted-foreground flex flex-col gap-1 list-decimal list-inside">
          <li><a href="#api-key" className="text-primary hover:underline underline-offset-2">AI キーの取得方法</a></li>
          <li><a href="#byok" className="text-primary hover:underline underline-offset-2">BYOK について</a></li>
          <li><a href="#faq" className="text-primary hover:underline underline-offset-2">よくある質問</a></li>
          <li><a href="#shortcuts" className="text-primary hover:underline underline-offset-2">キーボードショートカット</a></li>
        </ol>
      </nav>

      <hr className="border-border" />

      {/* AI キーの取得方法 */}
      <section id="api-key" className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">1. AI キーの取得方法</h2>

        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold">Google Gemini（無料・有料プランで使用可能）</h3>
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <ol className="text-sm text-muted-foreground flex flex-col gap-2 list-decimal list-inside">
              <li>
                Google AI Studio にアクセスする →{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-2"
                >
                  https://aistudio.google.com/apikey
                </a>
              </li>
              <li>「Get API key」をクリックしてキーを作成する</li>
              <li>作成されたキーをコピーする</li>
              <li>Notea の設定 → AI キー管理 → Gemini のキーを登録する</li>
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold">OpenAI（有料プランのみ）</h3>
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <ol className="text-sm text-muted-foreground flex flex-col gap-2 list-decimal list-inside">
              <li>
                OpenAI Platform にアクセスする →{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-2"
                >
                  https://platform.openai.com/api-keys
                </a>
              </li>
              <li>「Create new secret key」をクリックする</li>
              <li>作成されたキーをコピーする（一度しか表示されません）</li>
              <li>Notea の設定 → AI キー管理 → OpenAI のキーを登録する</li>
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold">Anthropic（有料プランのみ）</h3>
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <ol className="text-sm text-muted-foreground flex flex-col gap-2 list-decimal list-inside">
              <li>
                Anthropic Console にアクセスする →{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-2"
                >
                  https://console.anthropic.com/settings/keys
                </a>
              </li>
              <li>「Create Key」をクリックする</li>
              <li>作成されたキーをコピーする</li>
              <li>Notea の設定 → AI キー管理 → Anthropic のキーを登録する</li>
            </ol>
          </div>
        </div>
      </section>

      <hr className="border-border" />

      {/* BYOK について */}
      <section id="byok" className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">2. BYOK について</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Q: API キーはどこに保存されますか？</p>
            <p className="text-sm text-muted-foreground">
              A: キーはあなたが使っているブラウザの localStorage にのみ保存されます。Notea のサーバーや DB には送信・保存されません。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Q: AI を使ったとき Notea は何を記録しますか？</p>
            <p className="text-sm text-muted-foreground">
              A: Notea のサーバーが記録するのは「今日何回 AI を利用したか」という回数のみです。入力した文章（プロンプト）や AI の回答内容は Notea のサーバーには送られません。
            </p>
          </div>
        </div>

        {/* セキュリティ注意事項 */}
        <div className="bg-muted/50 border border-border rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm font-medium">API キーのセキュリティについて</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Notea は API キーを Notea のサーバーや DB に保存しません。
            キーはあなたが今使っているブラウザの localStorage にのみ保存されます。
            これにより、仮に Notea のサーバーへの不正アクセスがあっても、あなたの API キーは守られます。
          </p>
          <p className="text-sm text-muted-foreground font-medium">ただし、キーのセキュリティはご利用の端末・ブラウザ環境の安全性に依存します。</p>
          <ul className="text-sm text-muted-foreground flex flex-col gap-1">
            <li>・共用 PC や他人が操作できるデバイスでは使用しないことをお勧めします</li>
            <li>・ブラウザのデータを消去（キャッシュ削除など）するとキーも削除されます</li>
            <li>・端末を変えたり、新しいブラウザで開いたりした場合は再登録が必要です</li>
          </ul>
        </div>
      </section>

      <hr className="border-border" />

      {/* よくある質問 */}
      <section id="faq" className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">3. よくある質問</h2>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Q: スマホで AI を使うには？</p>
            <p className="text-sm text-muted-foreground">
              A: スマホでも同じように Notea の設定から API キーを登録できます。ただし、PC に登録したキーとスマホのキーは別々に保存されます。スマホでも使いたい場合は、スマホのブラウザで Notea を開いて再度キーを登録してください。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Q: キーを削除したらどうなりますか？</p>
            <p className="text-sm text-muted-foreground">
              A: そのブラウザからキーが削除され、AI 機能が使えなくなります。再登録すれば再び使えます。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Q: キーが漏れないか心配です。</p>
            <p className="text-sm text-muted-foreground">
              A: キーはブラウザの localStorage にのみ保存され、Notea のサーバーに送信されることはありません。ただし、キーのセキュリティはご利用の端末・ブラウザの安全性に依存します。共用 PC では使用しないことをお勧めします。
            </p>
          </div>
        </div>
      </section>

      <hr className="border-border" />

      {/* キーボードショートカット */}
      <section id="shortcuts" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">4. キーボードショートカット</h2>
        <p className="text-sm text-muted-foreground">
          以下のショートカットはアプリ内（入力欄以外）で使用できます。
        </p>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2 text-left font-medium">操作</th>
                <th className="px-4 py-2 text-left font-medium">キー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2 text-muted-foreground">新規ページ作成</td>
                <td className="px-4 py-2">
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">Ctrl/Cmd + N</kbd>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-muted-foreground">設定を開く</td>
                <td className="px-4 py-2">
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">Ctrl/Cmd + ,</kbd>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-muted-foreground">サイドバー表示/非表示</td>
                <td className="px-4 py-2">
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono">Ctrl/Cmd + \</kbd>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
