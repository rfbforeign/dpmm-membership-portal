import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function requireUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon pooled connection string."
    );
  }
  return url;
}

let instance: ReturnType<typeof createDb> | undefined;

function createDb() {
  return drizzle({ client: neon(requireUrl()), schema });
}

/** Shared Drizzle client. Created on first use, so `next build` works without env vars. */
export function getDb() {
  instance ??= createDb();
  return instance;
}

/** Raw SQL tagged-template client, for views and reports: await getSql()`SELECT ...` */
export function getSql() {
  return neon(requireUrl());
}
