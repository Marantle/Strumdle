/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/analytics?date=2026-03-12
 *
 * Queries Cloudflare Analytics Engine SQL API to return named stats.
 * Requires env vars: CF_ACCOUNT_ID, CF_API_TOKEN
 */

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    const missing = [
      !env.CF_ACCOUNT_ID ? "CF_ACCOUNT_ID" : null,
      !env.CF_API_TOKEN ? "CF_API_TOKEN" : null,
    ].filter(Boolean);

    return new Response(JSON.stringify({
      error: "Missing required environment variables",
      missing,
    }), {
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
