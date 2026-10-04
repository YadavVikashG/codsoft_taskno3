const { randomBytes, scrypt: nodeScrypt } = require("node:crypto");
const { promisify } = require("node:util");
const readline = require("node:readline/promises");
const { loadEnvConfig } = require("@next/env");
const { Pool } = require("pg");

loadEnvConfig(process.cwd());
const scrypt = promisify(nodeScrypt);

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Run this command in an interactive terminal.");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          reject(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local first.");
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = (await prompt.question("Admin email: ")).trim().toLowerCase();
  prompt.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const password = await readHidden("Admin password (10+ characters, input hidden): ");
  if (password.length < 10 || password.length > 200) throw new Error("Password must be between 10 and 200 characters.");
  const confirmation = await readHidden("Confirm admin password (input hidden): ");
  if (password !== confirmation) throw new Error("The passwords do not match.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', disabled = FALSE`,
      [`admin-${randomBytes(16).toString("hex")}`, email.split("@")[0], email, `${salt}:${derived.toString("hex")}`],
    );
    console.log("Administrator account is ready. Sign in through CareerHub.");
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});