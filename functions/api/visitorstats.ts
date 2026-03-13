/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/visitorstats
 *
 * Internal-only analytics endpoint. Returns daily play counts (last 30 days)
 * and hourly-of-day distribution (last 7 days) from Analytics Engine.
 *
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

async function queryAnalytics(accountId: string, token: string, sql: string) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Analytics query failed: ${text}`);
  }
  return resp.json<{ data: Record<string, string | number>[] }>();
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const [dailyResult, hourlyResult] = await Promise.all([
      // Daily totals for the last 30 days
      queryAnalytics(env.CF_ACCOUNT_ID, env.CF_API_TOKEN, `
        SELECT
          toDate(timestamp)        AS date,
          COUNT()                  AS plays,
          countIf(blob1 = 'solved') AS solves
        FROM strumdle
        WHERE timestamp >= now() - INTERVAL '30' DAY
        GROUP BY date
        ORDER BY date ASC
      `),
      // Hour-of-day distribution for the last 7 days
      queryAnalytics(env.CF_ACCOUNT_ID, env.CF_API_TOKEN, `
        SELECT
          toHour(timestamp)        AS hour,
          COUNT()                  AS plays,
          countIf(blob1 = 'solved') AS solves
        FROM strumdle
        WHERE timestamp >= now() - INTERVAL '7' DAY
        GROUP BY hour
        ORDER BY hour ASC
      `),
    ]);

    const daily = dailyResult.data.map((r) => ({
      date: String(r.date),
      plays: Number(r.plays),
      solves: Number(r.solves),
    }));

    // Fill in all 24 hours (missing hours = 0 plays)
    const hourlyMap = new Map(hourlyResult.data.map((r) => [Number(r.hour), { plays: Number(r.plays), solves: Number(r.solves) }]));
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      plays: hourlyMap.get(h)?.plays ?? 0,
      solves: hourlyMap.get(h)?.solves ?? 0,
    }));

    return new Response(JSON.stringify({ daily, hourly }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
};
