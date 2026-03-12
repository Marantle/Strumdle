/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Pages Function: game stats collection.
 *
 * POST /api/stats — record a game completion
 * GET  /api/stats — retrieve aggregate stats for a date (or today)
 *
 * Data stored in both:
 *   - Cloudflare KV (STATS namespace) — simple read-modify-write, 1k writes/day free
 *   - Analytics Engine (ANALYTICS) — append-only events, 100k/day free, no race conditions
 *
 * No PII is collected — only date, solved/failed, and attempt count.
 */

interface Env {
  STATS: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  IP_HASH_SALT?: string;
}

interface GameResult {
  date: string;       // "2026-03-12"
  solved: boolean;
  attempts: number;   // 1-6
}

interface DayStats {
  plays: number;
  solves: number;
  attempts: Record<string, number>; // { "1": 5, "2": 12, ... }
}

function emptyStats(): DayStats {
  return { plays: 0, solves: 0, attempts: {} };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  return Array.from(view).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashIp(ip: string, salt: string | undefined): Promise<string> {
  // Salted hash prevents storing raw IP and makes brute-force reversal harder.
  return sha256Hex(`${salt ?? ""}:${ip}`);
}

function isValidResult(body: unknown): body is GameResult {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return false;
  if (typeof b.solved !== "boolean") return false;
  if (typeof b.attempts !== "number" || b.attempts < 1 || b.attempts > 10) return false;
  return true;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!isValidResult(body)) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const cfIp = request.headers.get("CF-Connecting-IP");
  const xff = request.headers.get("X-Forwarded-For");
  const fallbackIp = xff?.split(",")[0]?.trim();
  const clientIp = cfIp ?? fallbackIp ?? null;

  if (clientIp) {
    const ipHash = await hashIp(clientIp, env.IP_HASH_SALT);
    const dedupeKey = `stats-ip:${body.date}:${ipHash}`;
    const seen = await env.STATS.get(dedupeKey);
    if (seen) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Keep dedupe records for long enough to cover replays of old challenge dates.
    await env.STATS.put(dedupeKey, "1", { expirationTtl: 60 * 60 * 24 * 400 });
  }

  const key = `stats:${body.date}`;

  // Read-modify-write with KV
  const existing = await env.STATS.get<DayStats>(key, "json");
  const stats = existing ?? emptyStats();

  stats.plays++;
  if (body.solved) {
    stats.solves++;
    const k = String(body.attempts);
    stats.attempts[k] = (stats.attempts[k] ?? 0) + 1;
  }

  await env.STATS.put(key, JSON.stringify(stats));

  // Also write to Analytics Engine (append-only, no race conditions)
  env.ANALYTICS.writeDataPoint({
    indexes: [body.date],
    blobs: [body.solved ? "solved" : "failed"],
    doubles: [body.attempts],
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: "Invalid date" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const key = `stats:${date}`;
  const stats = await env.STATS.get<DayStats>(key, "json") ?? emptyStats();

  return new Response(JSON.stringify({ date, ...stats }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};
