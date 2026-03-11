/**
 * Shifts all schedule.json dates so the first entry starts today.
 * Useful during development before the app is released.
 *
 * Usage: npx tsx scripts/reschedule.ts
 */

import { readFileSync, writeFileSync } from "fs";

const schedule = JSON.parse(readFileSync("data/schedule.json", "utf8"));

if (schedule.length === 0) {
  console.log("Schedule is empty, nothing to reschedule.");
  process.exit(0);
}

// Today in Eastern time (same convention as generate-daily.ts)
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/New_York",
});

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split("T")[0];
}

for (let i = 0; i < schedule.length; i++) {
  schedule[i].date = addDays(today, i);
}

writeFileSync("data/schedule.json", JSON.stringify(schedule, null, 2));
console.log(
  `Rescheduled ${schedule.length} entries: ${schedule[0].date} → ${schedule[schedule.length - 1].date}`,
);
