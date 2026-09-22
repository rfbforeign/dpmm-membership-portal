import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read Next.js's .env.local automatically
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Tooling uses the DIRECT connection (host without "-pooler")
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
