/// <reference types="@cloudflare/workers-types" />
/**
 * GET  /api/analytics?date=2026-03-12  — query Analytics Engine for daily stats
 * POST /api/analytics                  — record a game completion
 *
 * Requires env vars: CF_ACCOUNT_ID, CF_API_TOKEN, ANALYTICS
 * CF_ACCOUNT_ID + CF_API_TOKEN are also used on POST to detect first-time players via
 * a single Analytics Engine SQL query (gracefully skipped if credentials are absent).
 */

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  ANALYTICS: AnalyticsEngineDataset;
  IP_HASH_SALT: string;
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

  const todayUtc = new Date().toISOString().split("T")[0];
  const isArchive = body.date !== todayUtc ? "archive" : "";

  // Detect first-time players via one Analytics Engine SQL query.
  // Gracefully skipped if credentials are absent or the query fails.
  let playerType = "";
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp && env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
    try {
      const ipHash = await sha256Hex((env.IP_HASH_SALT ?? "") + clientIp);
      const checkSql = `SELECT COUNT() AS cnt FROM strumdle WHERE blob4 = '${ipHash}'`;
      const checkResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "text/plain",
          },
          body: checkSql,
        }
      );
      if (checkResp.ok) {
        const checkData = await checkResp.json<{ data?: { cnt: string }[] }>();
        const cnt = parseInt(checkData.data?.[0]?.cnt ?? "0", 10);
        if (cnt === 0) playerType = "first";
      } else {
        console.error("[analytics] first-timer query non-ok:", checkResp.status, await checkResp.text());
      }

      env.ANALYTICS.writeDataPoint({
        indexes: [body.date],
        blobs: [body.solved ? "solved" : "failed", isArchive, playerType, ipHash],
        doubles: [body.attempts],
      });
    } catch (err) {
      console.error("[analytics] first-timer check failed:", err);
      env.ANALYTICS.writeDataPoint({
        indexes: [body.date],
        blobs: [body.solved ? "solved" : "failed", isArchive],
        doubles: [body.attempts],
      });
    }
  } else {
    env.ANALYTICS.writeDataPoint({
      indexes: [body.date],
      blobs: [body.solved ? "solved" : "failed", isArchive],
      doubles: [body.attempts],
    });
  }

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
      blob2        AS play_type,
      blob3        AS player_type,
      double1      AS attempts,
      COUNT()      AS count
    FROM strumdle
    WHERE index1 = '${date}'
    GROUP BY date, result, play_type, player_type, attempts
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

  const body = await resp.json<{ data?: { date: string; result: string; play_type: string; player_type: string; attempts: number; count: string }[] }>();
  const data = body.data ?? [];

  let plays = 0;
  let solves = 0;
  let archivePlays = 0;
  let firstTimers = 0;
  const attempts: Record<string, number> = {};

  for (const row of data) {
    const count = parseInt(row.count, 10);
    plays += count;
    if (row.play_type === "archive") archivePlays += count;
    if (row.player_type === "first") firstTimers += count;
    if (row.result === "solved") {
      solves += count;
      const k = String(row.attempts);
      attempts[k] = (attempts[k] ?? 0) + count;
    }
  }

  return new Response(JSON.stringify({ date, plays, solves, archivePlays, firstTimers, attempts }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};
