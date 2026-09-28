import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_OPTIONS,
  checkRateLimit,
  getClientIp,
  issueSessionToken,
  recordFailure,
  recordSuccess,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const { locked, retryAfterSec } = checkRateLimit(ip);
  if (locked) {
    return NextResponse.json(
      { success: false, error: "試行回数が上限に達しました", retryAfterSec },
      { status: 429 }
    );
  }

  let password: string | undefined;
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ success: false, error: "リクエストが不正です" }, { status: 400 });
  }

  if (!password || !verifyPassword(password)) {
    const result = recordFailure(ip);
    if (result.locked) {
      return NextResponse.json(
        { success: false, error: "試行回数が上限に達しました", retryAfterSec: result.retryAfterSec },
        { status: 429 }
      );
    }
    return NextResponse.json({ success: false, error: "パスワードが正しくありません" }, { status: 401 });
  }

  recordSuccess(ip);
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, issueSessionToken(), AUTH_COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
