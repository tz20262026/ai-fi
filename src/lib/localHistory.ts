"use client";

/**
 * 分析履歴のクライアント側永続化(localStorage)。
 *
 * Vercelのサーバーレス関数はリクエストごとの使い捨てコンテナで実行されるため、
 * サーバー側のファイル書き込み(旧 src/lib/db.ts)は本番環境で永続化されない。
 * そこで履歴はすべてブラウザのlocalStorageに保存し、追加インフラなしで機能させる。
 */

export type AnalysisStatus = "pending" | "completed" | "error";

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AnalysisStatus;
  mode: string;
  companyName: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  /** completed後はnullにして容量を節約。pending/errorの間だけ保持し再分析に使う */
  fileData: string | null;
  rawText: string;
  parsedData: string;
  errorMessage: string | null;
}

const STORAGE_KEY = "ai_fi_history_v1";
const MAX_RECORDS = 20;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): AnalysisRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sortDesc(records: AnalysisRecord[]): AnalysisRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function writeAll(records: AnalysisRecord[]) {
  if (!isBrowser()) return;
  const trimmed = sortDesc(records).slice(0, MAX_RECORDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return;
  } catch {
    /* 容量オーバー。段階的に縮小して再試行する */
  }
  try {
    const stripped = trimmed.map((r) => ({ ...r, fileData: null }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    return;
  } catch {
    /* まだ収まらない */
  }
  try {
    const half = trimmed
      .slice(0, Math.max(1, Math.floor(trimmed.length / 2)))
      .map((r) => ({ ...r, fileData: null }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
  } catch {
    // 諦める。分析結果自体は画面には表示済みなのでユーザー体験としてのデータ消失にはならない
  }
}

function generateId(): string {
  if (isBrowser() && window.crypto && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const localHistory = {
  getAll(): AnalysisRecord[] {
    return sortDesc(readAll());
  },

  getById(id: string): AnalysisRecord | null {
    return readAll().find((r) => r.id === id) ?? null;
  },

  create(data: Omit<AnalysisRecord, "id" | "createdAt" | "updatedAt">): AnalysisRecord {
    const now = new Date().toISOString();
    const record: AnalysisRecord = { id: generateId(), createdAt: now, updatedAt: now, ...data };
    const all = readAll();
    all.push(record);
    writeAll(all);
    return record;
  },

  update(
    id: string,
    patch: Partial<Omit<AnalysisRecord, "id" | "createdAt">>
  ): AnalysisRecord | null {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  remove(id: string) {
    writeAll(readAll().filter((r) => r.id !== id));
  },

  /** 指定モードの直近完了済みレコードを新しい順にlimit件返す(トレンド比較のコンテキストに使う) */
  getRecentCompleted(mode: string, limit = 3): AnalysisRecord[] {
    return sortDesc(readAll())
      .filter((r) => r.mode === mode && r.status === "completed")
      .slice(0, limit);
  },
};
