import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aifi-delta.vercel.app"),
  title: "AI財務アドバイザー | Powered by Gemini 2.5 Flash",
  description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  // 財務数値を電話番号・日付としてOSが勝手にリンク化するのを防ぐ
  formatDetection: { telephone: false, date: false, address: false, email: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AI財務" },
  openGraph: {
    title: "AI財務アドバイザー | Powered by Gemini 2.5 Flash",
    description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
    images: ["https://aifi-delta.vercel.app/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI財務アドバイザー | Powered by Gemini 2.5 Flash",
    description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
    images: ["https://aifi-delta.vercel.app/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
