// Creates (or updates) the QStash schedule that calls the dispatcher every 15 minutes.
// Run once after deploying: npm run jobs:schedule
import { Client } from "@upstash/qstash";

const { QSTASH_TOKEN, QSTASH_URL, APP_URL } = process.env;
if (!QSTASH_TOKEN || !APP_URL) {
  console.error("QSTASH_TOKEN and APP_URL must be set in .env.local.");
  process.exit(1);
}
if (APP_URL.includes("localhost")) {
  console.error("APP_URL must be your public deployment. QStash can't reach localhost.");
  process.exit(1);
}

const client = new Client({ token: QSTASH_TOKEN, baseUrl: QSTASH_URL });
const destination = `${APP_URL.replace(/\/+$/, "")}/api/jobs/dispatch`;

// A fixed ID means running this again updates the schedule instead of adding a second one.
const { scheduleId } = await client.schedules.create({
  scheduleId: "vitalwatch-dispatch",
  destination,
  cron: "*/15 * * * *",
  retries: 1,
});
console.log(`Schedule ${scheduleId} calls ${destination} every 15 minutes.`);
