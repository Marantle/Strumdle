/**
 * Shifts all schedule.json dates so the first entry starts today.
 * Useful during development before the app is released.
 *
 * Usage: npm run reschedule
 */

import { readFileSync, writeFileSync } from "fs";
import { addDays, todayUtc } from "./lib/scheduleUtils.ts";

const schedule = JSON.parse(readFileSync("data/schedule.json", "utf8"));

if (schedule.length === 0) {
  console.log("Schedule is empty, nothing to reschedule.");
  process.exit(0);
}

const today = todayUtc();

for (let i = 0; i < schedule.length; i++) {
  schedule[i].date = addDays(today, i);
}

writeFileSync("data/schedule.json", JSON.stringify(schedule, null, 2));
console.log(
  `Rescheduled ${schedule.length} entries: ${schedule[0].date} → ${schedule[schedule.length - 1].date}`,
);
