export function BYOKExplainer() {
  return (
    <section className="py-20 bg-muted/30 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <h2 className="text-2xl md:text-3xl font-bold">AI はあなた自身のキーで動きます</h2>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Notea で AI を使うには、Google Gemini・OpenAI・Anthropic などの API キーを
          ご自身で取得して、ブラウザに登録するだけです。
        </p>

        <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium shrink-0">・</span>
            キーは Notea のサーバーに渡りません（ブラウザにのみ保存）
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium shrink-0">・</span>
            AI の費用は各プロバイダに直接支払うため、Notea への上乗せはありません
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium shrink-0">・</span>
            PC とスマホでは別々にキーを登録する必要があります
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">
          無料プランでは Google Gemini のキーのみ登録できます（5回/日）。
          プレミアムプランでは OpenAI・Anthropic のキーも使えます（100回/日）。
        </p>
      </div>
    </section>
  )
}
