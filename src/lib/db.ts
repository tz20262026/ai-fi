import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "analyses.json");

export type AnalysisStatus = "pending" | "completed" | "error";

export interface Analysis {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AnalysisStatus;
  mode: string;
  companyName: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  /** base64 for binary (PDF/image), plain text for Word/Excel/txt */
  fileData: string | null;
  rawText: string;
  parsedData: string;
  errorMessage: string | null;
}

function readDb(): Analysis[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeDb(analyses: Analysis[]) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(analyses, null, 2));
}

export const db = {
  analysis: {
    findMany(opts?: {
      where?: { mode?: string; status?: AnalysisStatus };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
    }): Promise<Analysis[]> {
      let data = readDb();
      if (opts?.where?.mode) data = data.filter((a) => a.mode === opts.where!.mode);
      if (opts?.where?.status) data = data.filter((a) => a.status === opts.where!.status);
      data.sort(
        (a, b) =>
          (opts?.orderBy?.createdAt === "asc" ? 1 : -1) *
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
      if (opts?.take) data = data.slice(0, opts.take);
      return Promise.resolve(data);
    },

    findById(id: string): Promise<Analysis | null> {
      const data = readDb();
      return Promise.resolve(data.find((a) => a.id === id) ?? null);
    },

    create(opts: { data: Omit<Analysis, "id" | "createdAt" | "updatedAt"> }): Promise<Analysis> {
      const data = readDb();
      const now = new Date().toISOString();
      const record: Analysis = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...opts.data,
      };
      data.push(record);
      writeDb(data);
      return Promise.resolve(record);
    },

    update(opts: { where: { id: string }; data: Partial<Omit<Analysis, "id" | "createdAt">> }): Promise<Analysis | null> {
      const data = readDb();
      const idx = data.findIndex((a) => a.id === opts.where.id);
      if (idx === -1) return Promise.resolve(null);
      data[idx] = { ...data[idx], ...opts.data, updatedAt: new Date().toISOString() };
      writeDb(data);
      return Promise.resolve(data[idx]);
    },

    delete(opts: { where: { id: string } }): Promise<{ id: string }> {
      const data = readDb();
      writeDb(data.filter((a) => a.id !== opts.where.id));
      return Promise.resolve({ id: opts.where.id });
    },
  },
};
