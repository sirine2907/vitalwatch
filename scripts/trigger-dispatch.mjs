// Runs the dispatcher once against the local dev server, standing in for QStash.
// Usage: npm run jobs:dispatch (with `npm run dev` running)
const base = process.argv[2] ?? "http://localhost:3000";

const response = await fetch(`${base}/api/jobs/dispatch`, { method: "POST" });
const body = await response.text();
console.log(`${response.status} ${body}`);
if (response.status === 401) {
  console.log("Unsigned calls only work in development without QStash signing keys set.");
}
