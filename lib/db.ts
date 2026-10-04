import { Pool } from "pg";

const globalForPostgres = globalThis as typeof globalThis & { careerHubPool?: Pool };

export const pool = process.env.DATABASE_URL
  ? (globalForPostgres.careerHubPool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    }))
  : null;