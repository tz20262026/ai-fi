import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * パスワードゲートの実体。
 * これまでは NEXT_PUBLIC_SITE_PASSWORD をクライアントJSバンドルに埋め込んで
 * ブラウザ側で平文比較していたため、デプロイ後のJSを読めば誰でもパスワードを
 * 抜き取れる状態だった。加えて /api/analyze 系はゲートを経由せず直接叩けたため、
 * パスワードを知らなくてもGemini APIを消費できてしまっていた。
 * ここでは検証をサーバー側に一本化し、httpOnly Cookieでセッションを判定する。
 */

export const AUTH_COOKIE = "ai_fi_session";
const AUTH_MAX_AGE_SEC = 60 * 60 * 12; // 12時間

function getSitePassword(): string {
  return process.env.SITE_PASSWORD || "1234";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** パスワード自体を保存せず、パスワードから決定的に導出できるセッション用トークン */
function getExpectedToken(): string {
  return crypto.createHash("sha256").update(`ai_fi_session:${getSitePassword()}`).digest("hex");
}

export function verifyPassword(password: string): boolean {
  return timingSafeStringEqual(password, getSitePassword());
}

export function issueSessionToken(): string {
  return getExpectedToken();
}

export function isAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return false;
  return timingSafeStringEqual(cookie, getExpectedToken());
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_MAX_AGE_SEC,
};

// --- 総当たり対策（サーバー側）---
// クライアント側にも表示用のロック処理はあるが、/api/auth を直接叩かれた場合の
// 実効的な防御はこちら。サーバーレス関数はインスタンスが使い回されないこともあるため
// 完全ではないが、何もしないよりはるかにマシな多層防御として機能する。
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkRateLimit(ip: string): { locked: boolean; retryAfterSec: number } {
  const entry = attempts.get(ip);
  if (!entry) return { locked: false, retryAfterSec: 0 };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordFailure(ip: string): { locked: boolean; retryAfterSec: number } {
  const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  attempts.set(ip, entry);
  return entry.lockedUntil > Date.now()
    ? { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) }
    : { locked: false, retryAfterSec: 0 };
}

export function recordSuccess(ip: string): void {
  attempts.delete(ip);
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// --- 分析API用レート制限（コスト防御）---
// /api/analyze・/api/analyze/retry は呼ばれるたびに有料のGemini APIを消費するため、
// ログイン済みCookieの漏洩や連打による想定外コストを防ぐための簡易制限。
// ログイン用の総当たり対策（attempts Map）とは目的が異なるため、別のMapで管理する。
// 正常利用は妨げたくないので、やや緩めのしきい値にしている。
const ANALYZE_LIMIT_PER_MINUTE = 5;
const ANALYZE_LIMIT_PER_HOUR = 20;
const ANALYZE_MINUTE_MS = 60_000;
const ANALYZE_HOUR_MS = 60 * ANALYZE_MINUTE_MS;
const analyzeRequestLog = new Map<string, number[]>(); // ip -> リクエスト時刻(ms)の配列

/**
 * 分析APIのレート制限をチェックし、制限内であればこの呼び出し自体を1回分として記録する。
 * （呼び出すたびにカウントされるため、実際にリクエストを受理する直前に1回だけ呼ぶこと）
 */
export function checkAnalyzeRateLimit(ip: string): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (analyzeRequestLog.get(ip) ?? []).filter((t) => now - t < ANALYZE_HOUR_MS);

  const withinMinute = recent.filter((t) => now - t < ANALYZE_MINUTE_MS);
  if (withinMinute.length >= ANALYZE_LIMIT_PER_MINUTE) {
    const oldest = Math.min(...withinMinute);
    analyzeRequestLog.set(ip, recent);
    return { limited: true, retryAfterSec: Math.ceil((ANALYZE_MINUTE_MS - (now - oldest)) / 1000) };
  }
  if (recent.length >= ANALYZE_LIMIT_PER_HOUR) {
    const oldest = Math.min(...recent);
    analyzeRequestLog.set(ip, recent);
    return { limited: true, retryAfterSec: Math.ceil((ANALYZE_HOUR_MS - (now - oldest)) / 1000) };
  }

  recent.push(now);
  analyzeRequestLog.set(ip, recent);
  return { limited: false, retryAfterSec: 0 };
}
