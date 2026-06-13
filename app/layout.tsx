import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notea — Notion 風メモアプリ（BYOK AI）",
  description: "ブロックエディタでメモを整理。AI はあなた自身の API キーで動きます。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy が x-nonce を request header に設定し、Next.js がこれを読んで
  // 生成する <script> タグに nonce を付与する（Next.js 13.4+ の公式パターン）。
  // headers() を呼ぶことで Next.js はこのレイアウト以下を完全動的レンダリングとして
  // 扱い、nonce を含む HTML がプリレンダキャッシュに乗るのを防ぐ。
  await headers();

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
