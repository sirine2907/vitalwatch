import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// --- Auth.js tables. The adapter requires these names and columns. ---

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// --- Application tables ---

export const strategyEnum = pgEnum("strategy", ["mobile", "desktop"]);
export const runStatusEnum = pgEnum("run_status", ["pending", "success", "failed"]);
export const runTriggerEnum = pgEnum("run_trigger", ["manual", "scheduled", "retest"]);
export const fieldScopeEnum = pgEnum("field_scope", ["url", "origin", "none"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("projects_user_idx").on(table.userId)],
);

export const projectUrls = pgTable(
  "project_urls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Always the normalized form from validateUrl, so duplicates can't sneak in.
    url: text("url").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("project_urls_project_url_unique").on(table.projectId, table.url)],
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    urlId: uuid("url_id")
      .notNull()
      .references(() => projectUrls.id, { onDelete: "cascade" }),
    strategy: strategyEnum("strategy").notNull(),
    status: runStatusEnum("status").notNull().default("pending"),
    trigger: runTriggerEnum("trigger").notNull().default("manual"),
    performanceScore: integer("performance_score"),
    labLcpMs: real("lab_lcp_ms"),
    labFcpMs: real("lab_fcp_ms"),
    labTbtMs: real("lab_tbt_ms"),
    labSiMs: real("lab_si_ms"),
    labTtfbMs: real("lab_ttfb_ms"),
    labCls: real("lab_cls"),
    fieldLcpMs: real("field_lcp_ms"),
    fieldInpMs: real("field_inp_ms"),
    fieldCls: real("field_cls"),
    fieldScope: fieldScopeEnum("field_scope"),
    lighthouseVersion: text("lighthouse_version"),
    finalUrl: text("final_url"),
    error: text("error"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("test_runs_trend_idx").on(table.urlId, table.strategy, table.createdAt.desc())],
);
