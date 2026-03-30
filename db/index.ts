import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import * as schema from './schema'

config({ path: ".env.local", override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const sql = neon(databaseUrl);
export const db = drizzle({ client: sql, schema  });
