import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon pooled connection string."
    );
  }
  return drizzle({ client: neon(url), schema });
}

let instance: ReturnType<typeof createDb> | undefined;

/** Returns the shared database client. Created on first use, so `next build` works without env vars. */
export function getDb() {
  instance ??= createDb();
  return instance;
}
