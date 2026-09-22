import {
  bigint,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tables the app code uses so far. The database has more (see db/sql/0000_init.sql);
 * each step adds the ones it needs here.
 */

// Case-insensitive text, so "Admin@x.com" and "admin@x.com" are the same email
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const entityType = pgEnum("entity_type", ["individual", "company", "cooperative"]);
export const userRole = pgEnum("user_role", ["member", "secretariat", "treasurer", "admin"]);
export const memberStatus = pgEnum("member_status", ["pending", "active", "expired", "suspended"]);

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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: citext("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("member"),
  isActive: boolean("is_active").notNull().default(true),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // SHA-256 of the cookie token. The token itself is never stored.
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessSectors = pgTable("business_sectors", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

export const businessTypes = pgTable("business_types", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

export const introducers = pgTable("introducers", {
  id: smallint("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipNo: text("membership_no").notNull().unique(),
  legacyMembershipNo: text("legacy_membership_no").unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  membershipTypeId: smallint("membership_type_id")
    .notNull()
    .references(() => membershipTypes.id),
  status: memberStatus("status").notNull().default("pending"),

  fullName: text("full_name").notNull(),
  companyName: text("company_name"),
  email: citext("email").notNull(), // deliberately not unique: some members share an email
  phone: text("phone"),
  officeTel: text("office_tel"),
  icNo: text("ic_no"), // sensitive: mask in lists, show in full only to roles that need it
  ssmNo: text("ssm_no"),

  businessSectorId: smallint("business_sector_id").references(() => businessSectors.id),
  businessTypeId: smallint("business_type_id").references(() => businessTypes.id),
  introducerId: smallint("introducer_id").references(() => introducers.id),

  mailingAddress: text("mailing_address"),
  registeredAddress: text("registered_address"),

  // "date" columns are returned as plain "YYYY-MM-DD" strings, so no time-zone surprises
  joinedDate: date("joined_date").notNull(),
  expiryDate: date("expiry_date"),

  legacyEntityType: text("legacy_entity_type"),
  legacyPaymentYear: smallint("legacy_payment_year"),
  legacyData: jsonb("legacy_data").notNull().default({}),

  adminNotes: text("admin_notes"),
  // When the applicant agreed to the personal-data notice. Null for imported members.
  pdpaConsentAt: timestamp("pdpa_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
