// Deletes e2e/probe test accounts (and everything they own, via FK cascades).
// Usage: node scripts/cleanup-test-users.mjs   (reads DATABASE_URL from .env.local)
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`DELETE FROM users WHERE email LIKE 'e2e-%@lostlink.test' OR email LIKE 'probe-%@lostlink.test' RETURNING email`;
console.log(`deleted ${rows.length} test users`);
const left = await sql`SELECT count(*)::int AS n FROM items`;
console.log(`items remaining: ${left[0].n}`);
