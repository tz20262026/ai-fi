import type { Metadata } from "next";
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
  title: "AI財務アドバイザー | Powered by Gemini 1.5 Pro",
  description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
  openGraph: {
    title: "AI財務アドバイザー | Powered by Gemini 1.5 Pro",
    description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
    images: ["https://aifi-delta.vercel.app/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI財務アドバイザー | Powered by Gemini 1.5 Pro",
    description: "AIが財務資料を分析し、銀行融資・投資・震災再建の観点でコンサルティングを提供します",
    images: ["https://aifi-delta.vercel.app/og-image.png"],
  },
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
