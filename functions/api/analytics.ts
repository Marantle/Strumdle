/// <reference types="@cloudflare/workers-types" />
/**
 * GET  /api/analytics?date=2026-03-12  — query Analytics Engine for daily stats
 * POST /api/analytics                  — record a game completion
 *
 * Requires env vars: CF_ACCOUNT_ID, CF_API_TOKEN, ANALYTICS, STATS, IP_HASH_SALT
 */

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  ANALYTICS: AnalyticsEngineDataset;
  STATS: KVNamespace;
  IP_HASH_SALT?: string;
}

interface GameResult {
  date: string;
  solved: boolean;
  attempts: number;
}

function isValidResult(body: unknown): body is GameResult {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return false;
  if (typeof b.solved !== "boolean") return false;
  if (typeof b.attempts !== "number" || b.attempts < 1 || b.attempts > 10) return false;
  return true;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  // IP deduplication
  const clientIp =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null;

  if (clientIp) {
    const ipHash = await sha256Hex(`${env.IP_HASH_SALT ?? ""}:${clientIp}`);
    const dedupeKey = `stats-ip:${body.date}:${ipHash}`;
    if (await env.STATS.get(dedupeKey)) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    await env.STATS.put(dedupeKey, "1", { expirationTtl: 60 * 60 * 24 * 400 });
  }

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

  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    const missing = [
      !env.CF_ACCOUNT_ID ? "CF_ACCOUNT_ID" : null,
      !env.CF_API_TOKEN ? "CF_API_TOKEN" : null,
    ].filter(Boolean);
    return new Response(JSON.stringify({ error: "Missing required environment variables", missing }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: "Invalid date" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const sql = `
    SELECT
      index1       AS date,
      blob1        AS result,
      double1      AS attempts,
      COUNT()      AS count
    FROM strumdle
    WHERE index1 = '${date}'
    GROUP BY date, result, attempts
    ORDER BY attempts ASC
  `;

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    return new Response(JSON.stringify({ error: "Analytics query failed", detail: text }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { data } = await resp.json<{ data: { date: string; result: string; attempts: number; count: string }[] }>();

  let plays = 0;
  let solves = 0;
  const attempts: Record<string, number> = {};

  for (const row of data) {
    const count = parseInt(row.count, 10);
    plays += count;
    if (row.result === "solved") {
      solves += count;
      const k = String(row.attempts);
      attempts[k] = (attempts[k] ?? 0) + count;
    }
  }

  return new Response(JSON.stringify({ date, plays, solves, attempts }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};
