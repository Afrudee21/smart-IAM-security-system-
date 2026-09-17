import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "iam_users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isLocked: boolean("is_locked").notNull().default(false),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("iam_users_username_idx").on(table.username),
    emailIdx: uniqueIndex("iam_users_email_idx").on(table.email),
  }),
);

export const rolesTable = pgTable(
  "iam_roles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("iam_roles_name_idx").on(table.name),
  }),
);

export const permissionsTable = pgTable(
  "iam_permissions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("iam_permissions_name_idx").on(table.name),
  }),
);

export const userRolesTable = pgTable("iam_user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  roleId: integer("role_id").notNull(),
});

export const rolePermissionsTable = pgTable("iam_role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull(),
  permissionId: integer("permission_id").notNull(),
});

export const sessionsTable = pgTable("iam_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionToken: text("session_token").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked: boolean("revoked").notNull().default(false),
});

export const loginAttemptsTable = pgTable("iam_login_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  success: boolean("success").notNull(),
  riskScore: integer("risk_score").notNull(),
  riskLevel: text("risk_level").notNull(),
  reason: text("reason").notNull(),
});

export const auditLogsTable = pgTable("iam_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  status: text("status").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  details: text("details").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const securityAlertsTable = pgTable("iam_security_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  riskScore: integer("risk_score").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const mfaCodesTable = pgTable(
  "iam_mfa_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    challengeId: text("challenge_id").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    challengeIdx: uniqueIndex("iam_mfa_challenge_idx").on(table.challengeId),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;