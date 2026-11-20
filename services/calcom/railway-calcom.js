/*
 * Railway helpers for the Cal.com image. Never prints secret values.
 *   node railway-calcom.js wait-db  -> wait until Postgres accepts connections (15 min max)
 *   node railway-calcom.js admin    -> empty database: create the first admin through Cal.com's
 *                                      own /api/auth/setup on a server bound to 127.0.0.1;
 *                                      CAL_ADMIN_RESET_PASSWORD=true: set the admin password
 */
"use strict";

const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");

const appRequire = createRequire("/calcom/apps/web/package.json");
const rootRequire = createRequire("/calcom/package.json");
const load = (name) => {
  try {
    return appRequire(name);
  } catch {
    return rootRequire(name);
  }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (msg) => console.log(`[railway] ${msg}`);
const warn = (msg) => console.warn(`[railway] WARNING: ${msg}`);

// Cal.com's admin rule (isPasswordValid strict): 15+ chars, upper, lower, digit.
const strongEnough = (p) => p.length >= 15 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

async function query(sql, params = []) {
  const { Client } = load("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

async function waitDb() {
  const deadline = Date.now() + 15 * 60 * 1000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await query("select 1");
      log("Postgres is reachable");
      return;
    } catch (error) {
      if (Date.now() > deadline) throw new Error(`Postgres unreachable for 15 minutes (${error.code || error.message})`);
      if (attempt === 1 || attempt % 6 === 0) log(`waiting for Postgres (${error.code || error.message})`);
      await sleep(5000);
    }
  }
}

function randomStrongPassword() {
  return `Aa1-${crypto.randomBytes(24).toString("base64url")}`;
}

async function waitHttp(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`temporary server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // not listening yet
    }
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function createFirstAdmin() {
  const env = process.env;
  let email = (env.CAL_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    warn("CAL_ADMIN_EMAIL is not a valid e-mail; using admin@example.com. Change it later in Settings.");
    email = "admin@example.com";
  }
  let username = (env.CAL_ADMIN_USERNAME || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!username) username = "admin";
  let fullName = (env.CAL_ADMIN_NAME || "").trim();
  if (fullName.length < 3) fullName = "Administrator";
  let password = env.CAL_ADMIN_PASSWORD || "";
  let locked = false;
  if (!strongEnough(password)) {
    warn("CAL_ADMIN_PASSWORD must have 15+ characters with upper- and lower-case letters and a digit; the admin gets a random password nobody knows. Set a valid CAL_ADMIN_PASSWORD and CAL_ADMIN_RESET_PASSWORD=true, then redeploy.");
    password = randomStrongPassword();
    locked = true;
  }

  const port = "3999";
  const child = spawn("yarn", ["next", "start", "-p", port, "-H", "127.0.0.1"], {
    cwd: "/calcom/apps/web",
    env: { ...env, PORT: port },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  try {
    await waitHttp(`http://127.0.0.1:${port}/auth/login`, child, 5 * 60 * 1000);
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, full_name: fullName, email_address: email, password }),
    });
    const text = (await response.text()).slice(0, 300);
    if (!response.ok) throw new Error(`first admin setup failed: HTTP ${response.status} ${text}`);
    log(`first admin ${email} (username ${username}) created${locked ? " (locked, see warning above)" : ""}`);
  } finally {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function resetPassword() {
  const env = process.env;
  if ((env.CAL_ADMIN_RESET_PASSWORD || "false").trim().toLowerCase() !== "true") return;
  const email = (env.CAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = env.CAL_ADMIN_PASSWORD || "";
  if (!strongEnough(password)) {
    warn("CAL_ADMIN_RESET_PASSWORD=true but CAL_ADMIN_PASSWORD is not strong enough (15+ chars, upper, lower, digit); nothing changed");
    return;
  }
  const users = await query("select id from users where lower(email) = $1", [email]);
  if (!users.length) {
    warn(`CAL_ADMIN_RESET_PASSWORD=true but no account ${email} exists; nothing changed`);
    return;
  }
  const { hash } = load("bcryptjs");
  const hashed = await hash(password, 12);
  await query(
    'insert into "UserPassword" (hash, "userId") values ($1, $2) on conflict ("userId") do update set hash = excluded.hash',
    [hashed, users[0].id],
  );
  log(`password of ${email} set from CAL_ADMIN_PASSWORD; set CAL_ADMIN_RESET_PASSWORD back to false`);
}

async function admin() {
  const [{ n }] = await query("select count(*)::int as n from users");
  if (n > 0) log("Cal.com already has accounts: first-admin setup skipped");
  else await createFirstAdmin();
  await resetPassword();
}

const command = process.argv[2];
const run = command === "wait-db" ? waitDb : command === "admin" ? admin : null;
if (!run) {
  console.error("usage: railway-calcom.js wait-db|admin");
  process.exit(2);
}
run().catch((error) => {
  console.error(`[railway] ERROR: ${error.message}`);
  process.exit(1);
});
