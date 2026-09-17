import { ImageResponse } from "next/og";

// PWAインストール時にAndroid/Chromeが推奨する512x512アイコンを返すRoute Handler
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 96,
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
        }}
      >
        <svg width="320" height="320" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
