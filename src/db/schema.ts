import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Step 1 schema: only the tables the starter page needs.
 * The database itself already has all 12 tables (see db/sql/0000_init.sql).
 * Step 2 adds the remaining tables here (members, invoices, payments, ...).
 */

export const entityType = pgEnum("entity_type", [
  "individual",
  "company",
  "cooperative",
]);

export const membershipTypes = pgTable("membership_types", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  fasal: text("fasal").notNull().unique(),
  category: text("category").notNull(),
  entityType: entityType("entity_type").notNull(),
  // numeric columns come back from Postgres as strings ("50.00"); format with lib/money.ts
  registrationFee: numeric("registration_fee", { precision: 10, scale: 2 }).notNull(),
  annualFee: numeric("annual_fee", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
