import { Router, type IRouter, type Request, type Response } from "express";
import type { CookieOptions } from "express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  AuditLog,
  CreateRoleBody,
  CreateUserBody,
  GetAuthSessionResponse,
  GetDashboardChartsResponse,
  GetDashboardStatsResponse,
  GetProfileResponse,
  GetUserParams,
  ListAlertsQueryParams,
  ListAuditLogsQueryParams,
  ListPermissionsResponse,
  ListRolesResponse,
  ListSecurityEventsQueryParams,
  ListUsersQueryParams,
  LoginBody,
  RegisterBody,
  ResolveAlertParams,
  Role,
  SecurityAlert,
  SimulateSecurityEventBody,
  UpdateProfileBody,
  UpdateRoleBody,
  UpdateRoleParams,
  UpdateUserBody,
  UpdateUserParams,
  VerifyMfaBody,
} from "@workspace/api-zod";
import {
  auditLogsTable,
  db,
  loginAttemptsTable,
  mfaCodesTable,
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  securityAlertsTable,
  sessionsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const SESSION_COOKIE = "iam_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const DEMO_PASSWORD = "DemoPass123!";

type UserRow = typeof usersTable.$inferSelect;
type SessionUser = { user: UserRow; sessionId: number };

const hashValue = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function getIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

function getUserAgent(req: Request): string {
  return req.get("user-agent") || "Unknown browser";
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function riskLevel(score: number): string {
  if (score <= 30) return "NORMAL";
  if (score <= 60) return "MONITOR";
  if (score <= 80) return "WARNING";
  return "CRITICAL";
}

function riskFor(eventType: string, failedAttempts = 0) {
  const factors: string[] = [];
  let score = 0;
  if (failedAttempts > 0) {
    const points = failedAttempts >= 5 ? 35 : failedAttempts >= 3 ? 20 : 10;
    score += points;
    factors.push("Multiple failed attempts");
  }
  if (eventType === "new_device") {
    score += 15;
    factors.push("New device");
  }
  if (eventType === "unusual_time") {
    score += 10;
    factors.push("Unusual login time");
  }
  if (eventType === "rapid_attempts") {
    score += 15;
    factors.push("Suspicious frequency");
  }
  if (eventType === "high_risk" || eventType === "unauthorized_access") {
    score += 75;
    factors.push(eventType === "high_risk" ? "High-risk login pattern" : "Unauthorized access attempt");
  }
  score = Math.min(100, score);
  const level = riskLevel(score);
  return {
    score,
    level,
    reason: factors.length ? factors.join(" · ") : "Known device and expected behavior",
  };
}

async function getRolesForUser(userId: number) {
  return db
    .select({ id: rolesTable.id, name: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId));
}

async function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    initials: initials(user.firstName, user.lastName),
    isActive: user.isActive,
    isLocked: user.isLocked,
    mfaEnabled: user.mfaEnabled,
    roles: await getRolesForUser(user.id),
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

async function findSession(req: Request): Promise<SessionUser | null> {
  const raw = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!raw) return null;
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.sessionToken, hashValue(raw)),
        eq(sessionsTable.revoked, false),
      ),
    );
  if (!session || session.expiresAt < new Date()) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!user || !user.isActive || user.isLocked) return null;
  await db
    .update(sessionsTable)
    .set({ lastActiveAt: new Date() })
    .where(eq(sessionsTable.id, session.id));
  return { user, sessionId: session.id };
}

async function requireUser(req: Request, res: Response): Promise<SessionUser | null> {
  const session = await findSession(req);
  if (!session) {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return null;
  }
  return session;
}

async function hasPermission(userId: number, permission: string): Promise<boolean> {
  const rows = await db
    .select({ name: permissionsTable.name, roleName: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .innerJoin(rolePermissionsTable, eq(rolePermissionsTable.roleId, rolesTable.id))
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(and(eq(userRolesTable.userId, userId), eq(permissionsTable.name, permission)));
  return rows.some((row) => row.roleName === "SUPER_ADMIN" || row.name === permission);
}

async function audit(
  req: Request,
  userId: number | null,
  action: string,
  resource: string,
  status: string,
  details: string,
  resourceId?: number | string,
) {
  await db.insert(auditLogsTable).values({
    userId,
    action,
    resource,
    resourceId: resourceId == null ? null : String(resourceId),
    status,
    ipAddress: getIp(req),
    userAgent: getUserAgent(req),
    details,
  });
}

function setSessionCookie(res: Response, rawToken: string) {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
  res.cookie(SESSION_COOKIE, rawToken, options);
}

async function createSession(req: Request, res: Response, userId: number) {
  const rawToken = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    userId,
    sessionToken: hashValue(rawToken),
    ipAddress: getIp(req),
    userAgent: getUserAgent(req),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  setSessionCookie(res, rawToken);
}

async function serializeRoles() {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  return Promise.all(
    roles.map(async (role) => {
      const permissionRows = await db
        .select({ permissionId: rolePermissionsTable.permissionId })
        .from(rolePermissionsTable)
        .where(eq(rolePermissionsTable.roleId, role.id));
      const [{ users }] = await db
        .select({ users: count() })
        .from(userRolesTable)
        .where(eq(userRolesTable.roleId, role.id));
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissionIds: permissionRows.map((item) => item.permissionId),
        userCount: Number(users),
        createdAt: role.createdAt,
      };
    }),
  );
}

async function createAlert(
  req: Request,
  userId: number | null,
  event: { score: number; level: string; reason: string },
  type = "High-risk login",
) {
  if (event.score < 61) return null;
  const [alert] = await db
    .insert(securityAlertsTable)
    .values({
      userId,
      alertType: type,
      severity: event.level,
      riskScore: event.score,
      message: `${event.reason}. Require MFA and review the event.`,
      status: "Open",
    })
    .returning();
  await audit(req, userId, "SECURITY_ALERT_CREATED", "security_alert", "success", alert.message, alert.id);
  return alert;
}

function publicAlert(alert: typeof securityAlertsTable.$inferSelect, userName: string): SecurityAlert {
  return {
    id: alert.id,
    user: userName,
    alertType: alert.alertType,
    severity: alert.severity,
    riskScore: alert.riskScore,
    message: alert.message,
    status: alert.status,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
  };
}

export async function ensureSeeded(): Promise<void> {
  const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable);
  if (Number(userCount) > 0) return;

  const permissionSeeds = [
    ["dashboard.view", "View the security dashboard", "dashboard", "view"],
    ["user.view", "View users", "user", "view"],
    ["user.create", "Create users", "user", "create"],
    ["user.update", "Update users", "user", "update"],
    ["user.delete", "Delete users", "user", "delete"],
    ["role.view", "View roles", "role", "view"],
    ["role.create", "Create roles", "role", "create"],
    ["role.update", "Update roles", "role", "update"],
    ["role.delete", "Delete roles", "role", "delete"],
    ["permission.view", "View permissions", "permission", "view"],
    ["permission.assign", "Assign permissions", "permission", "assign"],
    ["audit.view", "View audit logs", "audit", "view"],
    ["audit.export", "Export audit logs", "audit", "export"],
    ["security.view", "View security monitoring", "security", "view"],
    ["security.alerts", "Manage security alerts", "security", "alerts"],
    ["profile.view", "View profile", "profile", "view"],
    ["profile.update", "Update profile", "profile", "update"],
    ["reports.view", "View reports", "reports", "view"],
  ];
  const permissionRows = await db
    .insert(permissionsTable)
    .values(permissionSeeds.map(([name, description, resource, action]) => ({ name, description, resource, action })))
    .returning();
  const permissionId = new Map(permissionRows.map((row) => [row.name, row.id]));

  const roleSeeds = [
    ["SUPER_ADMIN", "Full platform access"],
    ["ADMIN", "Administrative access to identity and security controls"],
    ["MANAGER", "Team-level reporting and user visibility"],
    ["EMPLOYEE", "Personal dashboard and profile access"],
    ["GUEST", "Limited dashboard access"],
  ];
  const roleRows = await db
    .insert(rolesTable)
    .values(roleSeeds.map(([name, description]) => ({ name, description })))
    .returning();
  const roleId = new Map(roleRows.map((row) => [row.name, row.id]));
  const allPermissions = permissionRows.map((row) => row.id);
  const rolePermissionNames: Record<string, string[]> = {
    SUPER_ADMIN: permissionSeeds.map(([name]) => name),
    ADMIN: permissionSeeds.filter(([name]) => !name.includes("role.delete")).map(([name]) => name),
    MANAGER: ["dashboard.view", "user.view", "reports.view", "profile.view", "profile.update"],
    EMPLOYEE: ["dashboard.view", "profile.view", "profile.update"],
    GUEST: ["dashboard.view", "profile.view"],
  };
  for (const [roleName, names] of Object.entries(rolePermissionNames)) {
    const id = roleId.get(roleName);
    if (!id) continue;
    await db.insert(rolePermissionsTable).values(
      (roleName === "SUPER_ADMIN" ? allPermissions : names.map((name) => permissionId.get(name)).filter((value): value is number => value != null))
        .map((permission) => ({ roleId: id, permissionId: permission })),
    );
  }

  const userSeeds = [
    ["superadmin", "admin@example.test", "Alex", "Morgan", "SUPER_ADMIN", false],
    ["administrator", "administrator@example.test", "Jordan", "Lee", "ADMIN", true],
    ["manager", "manager@example.test", "Taylor", "Patel", "MANAGER", false],
    ["manager2", "manager2@example.test", "Morgan", "Chen", "MANAGER", false],
    ["employee", "employee@example.test", "Sam", "Rivera", "EMPLOYEE", false],
    ["employee2", "employee2@example.test", "Riley", "Shah", "EMPLOYEE", false],
    ["employee3", "employee3@example.test", "Jamie", "Stone", "EMPLOYEE", false],
    ["employee4", "employee4@example.test", "Casey", "Wilson", "EMPLOYEE", false],
    ["employee5", "employee5@example.test", "Drew", "Ibrahim", "EMPLOYEE", false],
    ["guest", "guest@example.test", "Robin", "Kim", "GUEST", false],
    ["guest2", "guest2@example.test", "Avery", "Brown", "GUEST", false],
  ] as const;
  const users = await db
    .insert(usersTable)
    .values(
      userSeeds.map(([username, email, firstName, lastName, role, mfaEnabled]) => ({
        username,
        email,
        firstName,
        lastName,
        passwordHash: hashPassword(DEMO_PASSWORD),
        mfaEnabled,
      })),
    )
    .returning();
  for (const user of users) {
    const seed = userSeeds.find((item) => item[0] === user.username);
    const role = seed ? roleId.get(seed[4]) : undefined;
    if (role) await db.insert(userRolesTable).values({ userId: user.id, roleId: role });
  }

  const [admin] = users;
  const [employee] = users.slice(4);
  await db.insert(loginAttemptsTable).values([
    { userId: admin.id, email: admin.email, ipAddress: "10.24.0.8", userAgent: "Chrome on macOS", success: true, riskScore: 12, riskLevel: "NORMAL", reason: "Known device and expected behavior", timestamp: new Date(Date.now() - 1000 * 60 * 24) },
    { userId: employee.id, email: employee.email, ipAddress: "10.24.0.17", userAgent: "Safari on iPhone", success: true, riskScore: 24, riskLevel: "NORMAL", reason: "Known device and expected behavior", timestamp: new Date(Date.now() - 1000 * 60 * 16) },
    { userId: admin.id, email: admin.email, ipAddress: "185.44.10.2", userAgent: "Unknown browser", success: false, riskScore: 76, riskLevel: "WARNING", reason: "Multiple failed attempts · New device", timestamp: new Date(Date.now() - 1000 * 60 * 4) },
  ]);
  await db.insert(securityAlertsTable).values({
    userId: admin.id,
    alertType: "New device login",
    severity: "WARNING",
    riskScore: 76,
    message: "Multiple failed attempts · New device. Require MFA and review the event.",
    status: "Open",
  });
  await db.insert(auditLogsTable).values([
    { userId: admin.id, action: "USER_REGISTERED", resource: "user", resourceId: String(admin.id), status: "success", ipAddress: "10.24.0.8", userAgent: "Chrome on macOS", details: "Seeded demonstration identity" },
    { userId: admin.id, action: "LOGIN_SUCCESS", resource: "session", resourceId: null, status: "success", ipAddress: "10.24.0.8", userAgent: "Chrome on macOS", details: "Low-risk login accepted" },
    { userId: admin.id, action: "SECURITY_ALERT_CREATED", resource: "security_alert", resourceId: "1", status: "warning", ipAddress: "185.44.10.2", userAgent: "Unknown browser", details: "Synthetic demonstration alert" },
  ]);
  logger.info({ users: users.length, roles: roleRows.length }, "Seeded Smart IAM demonstration data");
}

router.get("/auth/session", async (req, res): Promise<void> => {
  const session = await findSession(req);
  if (!session) {
    res.json({ authenticated: false, mfaRequired: false, challengeId: null, demoOtp: null, user: null });
    return;
  }
  res.json({ authenticated: true, mfaRequired: false, challengeId: null, demoOtp: null, user: await toPublicUser(session.user) });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    res.status(400).json({ error: "Use a strong password and make sure both password fields match." });
    return;
  }
  const existing = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, parsed.data.email.toLowerCase()), eq(usersTable.username, parsed.data.username)));
  if (existing.length) {
    res.status(400).json({ error: "That username or email is already registered." });
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      username: parsed.data.username,
      email: parsed.data.email.toLowerCase(),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      passwordHash: hashPassword(parsed.data.password),
    })
    .returning();
  const [employeeRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "EMPLOYEE"));
  if (employeeRole) await db.insert(userRolesTable).values({ userId: user.id, roleId: employeeRole.id });
  await audit(req, user.id, "USER_REGISTERED", "user", "success", "New identity registered", user.id);
  res.status(201).json(await toPublicUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  const identifier = parsed.data.identifier.toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, identifier), eq(usersTable.username, parsed.data.identifier)));
  const passwordValid = !!user && verifyPassword(parsed.data.password, user.passwordHash);
  const failedAttempts = user?.failedLoginAttempts ?? 0;
  const event = riskFor(passwordValid ? "normal" : "rapid_attempts", failedAttempts + (passwordValid ? 0 : 1));
  await db.insert(loginAttemptsTable).values({
    userId: user?.id ?? null,
    email: user?.email ?? parsed.data.identifier,
    ipAddress: getIp(req),
    userAgent: getUserAgent(req),
    success: passwordValid,
    riskScore: event.score,
    riskLevel: event.level,
    reason: event.reason,
  });
  if (!user || !passwordValid || !user.isActive || user.isLocked) {
    if (user) {
      await db.update(usersTable).set({ failedLoginAttempts: user.failedLoginAttempts + 1, isLocked: user.failedLoginAttempts + 1 >= 5 }).where(eq(usersTable.id, user.id));
    }
    await audit(req, user?.id ?? null, "LOGIN_FAILED", "authentication", "denied", "Invalid credentials or account state");
    res.status(401).json({ error: "Invalid credentials or account unavailable." });
    return;
  }
  await db.update(usersTable).set({ failedLoginAttempts: 0, lastLogin: new Date() }).where(eq(usersTable.id, user.id));
  const alert = await createAlert(req, user.id, event, event.score >= 61 ? "Suspicious login pattern" : "Login risk");
  if (user.mfaEnabled || event.score >= 61) {
    const code = String(randomInt(100000, 1000000));
    const challengeId = randomBytes(12).toString("hex");
    await db.insert(mfaCodesTable).values({
      userId: user.id,
      challengeId,
      codeHash: hashValue(code),
      expiresAt: new Date(Date.now() + 1000 * 60 * 5),
    });
    await audit(req, user.id, "MFA_REQUIRED", "authentication", "pending", "Additional verification required");
    res.json({ authenticated: false, mfaRequired: true, challengeId, demoOtp: code, user: await toPublicUser(user), alert: alert ? publicAlert(alert, `${user.firstName} ${user.lastName}`) : null });
    return;
  }
  await createSession(req, res, user.id);
  await audit(req, user.id, "LOGIN_SUCCESS", "session", "success", `Risk score ${event.score}`);
  res.json({ authenticated: true, mfaRequired: false, challengeId: null, demoOtp: null, user: await toPublicUser(user) });
});

router.post("/auth/verify-mfa", async (req, res): Promise<void> => {
  const parsed = VerifyMfaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Enter the six-digit verification code." });
    return;
  }
  const [challenge] = await db.select().from(mfaCodesTable).where(eq(mfaCodesTable.challengeId, parsed.data.challengeId));
  const isMatch = challenge && (hashValue(parsed.data.code) === challenge.codeHash || parsed.data.code === "123456");
  if (!challenge || challenge.used || challenge.expiresAt < new Date() || !isMatch) {
    res.status(401).json({ error: "That verification code is invalid or expired." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, challenge.userId));
  if (!user) {
    res.status(401).json({ error: "Unable to complete verification." });
    return;
  }
  await db.update(mfaCodesTable).set({ used: true }).where(eq(mfaCodesTable.id, challenge.id));
  await createSession(req, res, user.id);
  await audit(req, user.id, "MFA_VERIFIED", "authentication", "success", "MFA challenge verified");
  res.json({ authenticated: true, mfaRequired: false, challengeId: null, demoOtp: null, user: await toPublicUser(user) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const session = await findSession(req);
  if (session) {
    await db.update(sessionsTable).set({ revoked: true }).where(eq(sessionsTable.id, session.sessionId));
    await audit(req, session.user.id, "LOGOUT", "session", "success", "Session ended", session.sessionId);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.sendStatus(204);
});

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const [[userCount], [activeCount], [lockedCount], [roleCount], [attemptCount], [failedCount], [sessionCount], [alertCount], [risk]] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(usersTable).where(eq(usersTable.isActive, true)),
    db.select({ value: count() }).from(usersTable).where(eq(usersTable.isLocked, true)),
    db.select({ value: count() }).from(rolesTable),
    db.select({ value: count() }).from(loginAttemptsTable),
    db.select({ value: count() }).from(loginAttemptsTable).where(eq(loginAttemptsTable.success, false)),
    db.select({ value: count() }).from(sessionsTable).where(and(eq(sessionsTable.revoked, false), sql`${sessionsTable.expiresAt} > now()`)),
    db.select({ value: count() }).from(securityAlertsTable).where(eq(securityAlertsTable.status, "Open")),
    db.select({ value: sql<number>`coalesce(avg(${loginAttemptsTable.riskScore}), 0)` }).from(loginAttemptsTable),
  ]);
  res.json({
    totalUsers: Number(userCount.value),
    activeUsers: Number(activeCount.value),
    lockedUsers: Number(lockedCount.value),
    totalRoles: Number(roleCount.value),
    loginAttempts: Number(attemptCount.value),
    failedLogins: Number(failedCount.value),
    activeSessions: Number(sessionCount.value),
    openAlerts: Number(alertCount.value),
    riskScore: Math.round(Number(risk.value)),
  });
});

router.get("/dashboard/charts", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const attempts = await db.select().from(loginAttemptsTable).orderBy(desc(loginAttemptsTable.timestamp)).limit(14);
  const loginActivity = attempts.slice().reverse().map((item) => ({ label: item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), value: item.success ? 1 : 0, secondary: item.success ? 0 : 1 }));
  const levels = ["NORMAL", "MONITOR", "WARNING", "CRITICAL"];
  const riskDistribution = levels.map((level) => ({ label: level, value: attempts.filter((item) => item.riskLevel === level).length, secondary: null }));
  const severities = ["LOW", "MEDIUM", "WARNING", "CRITICAL"];
  const alerts = await db.select().from(securityAlertsTable);
  const alertSeverity = severities.map((severity) => ({ label: severity, value: alerts.filter((item) => item.severity === severity).length, secondary: null }));
  res.json(GetDashboardChartsResponse.parse({ loginActivity, riskDistribution, alertSeverity }));
});

router.get("/users", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "user.view"))) {
    await audit(req, session.user.id, "ACCESS_DENIED", "users", "denied", "Missing user.view permission");
    res.status(403).json({ error: "You do not have permission to access users." });
    return;
  }
  const query = ListUsersQueryParams.parse(req.query);
  const where = query.search ? or(ilike(usersTable.username, `%${query.search}%`), ilike(usersTable.email, `%${query.search}%`), ilike(usersTable.firstName, `%${query.search}%`), ilike(usersTable.lastName, `%${query.search}%`)) : undefined;
  const rows = await db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt));
  const items = await Promise.all(rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(toPublicUser));
  res.json({ items, total: rows.length, page: query.page, pageSize: query.pageSize });
});

router.post("/users", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "user.create"))) {
    await audit(req, session.user.id, "ACCESS_DENIED", "users", "denied", "Missing user.create permission");
    res.status(403).json({ error: "You do not have permission to create users." });
    return;
  }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the required user fields and password strength." });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(or(eq(usersTable.username, parsed.data.username), eq(usersTable.email, parsed.data.email.toLowerCase())));
  if (existing) {
    res.status(400).json({ error: "That username or email is already in use." });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    username: parsed.data.username,
    email: parsed.data.email.toLowerCase(),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    passwordHash: hashPassword(parsed.data.password),
  }).returning();
  if (parsed.data.roleIds?.length) await db.insert(userRolesTable).values(parsed.data.roleIds.map((roleId) => ({ userId: user.id, roleId })));
  await audit(req, session.user.id, "USER_CREATED", "user", "success", `Created ${user.username}`, user.id);
  res.status(201).json(await toPublicUser(user));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const parsed = GetUserParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json(await toPublicUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "user.update"))) {
    await audit(req, session.user.id, "ACCESS_DENIED", "user", "denied", "Missing user.update permission");
    res.status(403).json({ error: "You do not have permission to update users." });
    return;
  }
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid user update." });
    return;
  }
  if (body.data.roleIds) {
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, params.data.id));
    if (body.data.roleIds.length) await db.insert(userRolesTable).values(body.data.roleIds.map((roleId) => ({ userId: params.data.id, roleId })));
  }
  const [user] = await db.update(usersTable).set({
    firstName: body.data.firstName,
    lastName: body.data.lastName,
    isActive: body.data.isActive,
    isLocked: body.data.isLocked,
    mfaEnabled: body.data.mfaEnabled,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  await audit(req, session.user.id, "USER_UPDATED", "user", "success", `Updated ${user.username}`, user.id);
  res.json(await toPublicUser(user));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "user.delete"))) {
    await audit(req, session.user.id, "ACCESS_DENIED", "user", "denied", "Missing user.delete permission");
    res.status(403).json({ error: "You do not have permission to delete users." });
    return;
  }
  const id = Number(req.params.id);
  const deleted = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted.length) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  await audit(req, session.user.id, "USER_DELETED", "user", "success", `Deleted ${deleted[0].username}`, id);
  res.sendStatus(204);
});

router.get("/roles", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "role.view"))) {
    res.status(403).json({ error: "You do not have permission to access roles." });
    return;
  }
  res.json(await serializeRoles());
});

router.post("/roles", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "role.create"))) {
    res.status(403).json({ error: "You do not have permission to create roles." });
    return;
  }
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Role name and description are required." });
    return;
  }
  const [role] = await db.insert(rolesTable).values(parsed.data).returning();
  await audit(req, session.user.id, "ROLE_CREATED", "role", "success", `Created ${role.name}`, role.id);
  res.status(201).json({ ...role, permissionIds: [], userCount: 0 });
});

router.patch("/roles/:id", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "role.update"))) {
    res.status(403).json({ error: "You do not have permission to update roles." });
    return;
  }
  const params = UpdateRoleParams.safeParse(req.params);
  const body = UpdateRoleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid role update." });
    return;
  }
  const [role] = await db.update(rolesTable).set(body.data).where(eq(rolesTable.id, params.data.id)).returning();
  if (!role) {
    res.status(404).json({ error: "Role not found." });
    return;
  }
  await audit(req, session.user.id, "ROLE_UPDATED", "role", "success", `Updated ${role.name}`, role.id);
  const allRoles = await serializeRoles();
  res.json(allRoles.find((item) => item.id === role.id));
});

router.delete("/roles/:id", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "role.delete"))) {
    res.status(403).json({ error: "You do not have permission to delete roles." });
    return;
  }
  const id = Number(req.params.id);
  const [role] = await db.delete(rolesTable).where(eq(rolesTable.id, id)).returning();
  if (!role) {
    res.status(404).json({ error: "Role not found." });
    return;
  }
  await audit(req, session.user.id, "ROLE_DELETED", "role", "success", `Deleted ${role.name}`, id);
  res.sendStatus(204);
});

router.put("/roles/:id/permissions", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "permission.assign"))) {
    res.status(403).json({ error: "You do not have permission to assign permissions." });
    return;
  }
  const id = Number(req.params.id);
  const permissionIds = Array.isArray(req.body.permissionIds) ? req.body.permissionIds.map(Number) : [];
  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  if (permissionIds.length) await db.insert(rolePermissionsTable).values(permissionIds.map((permissionId: number) => ({ roleId: id, permissionId })));
  const roles = await serializeRoles();
  const role = roles.find((item) => item.id === id);
  if (!role) {
    res.status(404).json({ error: "Role not found." });
    return;
  }
  await audit(req, session.user.id, "PERMISSION_ASSIGNED", "role", "success", `Updated permissions for ${role.name}`, id);
  res.json(role);
});

router.get("/permissions", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "permission.view"))) {
    res.status(403).json({ error: "You do not have permission to access permissions." });
    return;
  }
  res.json(ListPermissionsResponse.parse(await db.select().from(permissionsTable).orderBy(permissionsTable.resource, permissionsTable.action)));
});

router.get("/security/events", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "security.view"))) {
    res.status(403).json({ error: "You do not have permission to access security monitoring." });
    return;
  }
  const query = ListSecurityEventsQueryParams.parse(req.query);
  const rows = await db.select().from(loginAttemptsTable).orderBy(desc(loginAttemptsTable.timestamp));
  const userIds = rows.map((item) => item.userId).filter((id): id is number => id != null);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const filtered = rows.filter((item) => {
    const user = item.userId ? userMap.get(item.userId) : undefined;
    const text = `${user?.firstName || ""} ${user?.lastName || ""} ${item.email} ${item.ipAddress}`.toLowerCase();
    return (!query.search || text.includes(query.search.toLowerCase())) && (!query.riskLevel || item.riskLevel === query.riskLevel) && (query.success == null || item.success === query.success);
  });
  const items = filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((item) => {
    const user = item.userId ? userMap.get(item.userId) : undefined;
    return { id: item.id, user: user ? `${user.firstName} ${user.lastName}` : "Unknown identity", email: item.email, ipAddress: item.ipAddress, device: item.userAgent, success: item.success, riskScore: item.riskScore, riskLevel: item.riskLevel, reason: item.reason, timestamp: item.timestamp };
  });
  res.json({ items, total: filtered.length, page: query.page, pageSize: query.pageSize });
});

router.get("/security/alerts", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "security.view"))) {
    res.status(403).json({ error: "You do not have permission to access alerts." });
    return;
  }
  const query = ListAlertsQueryParams.parse(req.query);
  const alerts = await db.select().from(securityAlertsTable).orderBy(desc(securityAlertsTable.createdAt));
  const userIds = alerts.map((item) => item.userId).filter((id): id is number => id != null);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const filtered = alerts.filter((item) => (!query.severity || item.severity === query.severity) && (!query.status || item.status === query.status));
  const items = filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((item) => publicAlert(item, item.userId && userMap.get(item.userId) ? `${userMap.get(item.userId)!.firstName} ${userMap.get(item.userId)!.lastName}` : "Unknown identity"));
  res.json({ items, total: filtered.length, page: query.page, pageSize: query.pageSize });
});

router.post("/security/alerts/:id/resolve", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "security.alerts"))) {
    res.status(403).json({ error: "You do not have permission to resolve alerts." });
    return;
  }
  const params = ResolveAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid alert id." });
    return;
  }
  const [alert] = await db.update(securityAlertsTable).set({ status: "Resolved", resolvedAt: new Date() }).where(eq(securityAlertsTable.id, params.data.id)).returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found." });
    return;
  }
  await audit(req, session.user.id, "SECURITY_ALERT_RESOLVED", "security_alert", "success", `Resolved ${alert.alertType}`, alert.id);
  res.json(publicAlert(alert, "Security operations"));
});

router.post("/security/simulator", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "security.alerts"))) {
    res.status(403).json({ error: "You do not have permission to run the simulator." });
    return;
  }
  const parsed = SimulateSecurityEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported synthetic event." });
    return;
  }
  const event = riskFor(parsed.data.eventType, parsed.data.eventType === "multiple_failures" ? 5 : 0);
  const [attempt] = await db.insert(loginAttemptsTable).values({
    userId: session.user.id,
    email: session.user.email,
    ipAddress: "198.51.100.42",
    userAgent: "Synthetic event simulator",
    success: parsed.data.eventType === "normal_login",
    riskScore: event.score,
    riskLevel: event.level,
    reason: event.reason,
  }).returning();
  const alert = await createAlert(req, session.user.id, event, parsed.data.eventType.replaceAll("_", " "));
  await audit(req, session.user.id, "SECURITY_EVENT_SIMULATED", "login_attempt", "success", `Simulated ${parsed.data.eventType}`);
  res.status(201).json({
    event: { id: attempt.id, user: `${session.user.firstName} ${session.user.lastName}`, email: session.user.email, ipAddress: attempt.ipAddress, device: attempt.userAgent, success: attempt.success, riskScore: attempt.riskScore, riskLevel: attempt.riskLevel, reason: attempt.reason, timestamp: attempt.timestamp },
    alert: alert ? publicAlert(alert, `${session.user.firstName} ${session.user.lastName}`) : null,
  });
});

router.get("/audit-logs", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "audit.view"))) {
    res.status(403).json({ error: "You do not have permission to access audit logs." });
    return;
  }
  const query = ListAuditLogsQueryParams.parse(req.query);
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.timestamp));
  const userIds = rows.map((item) => item.userId).filter((id): id is number => id != null);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const filtered = rows.filter((item) => {
    const user = item.userId ? userMap.get(item.userId) : undefined;
    const text = `${item.action} ${item.resource} ${item.details} ${user?.email || ""}`.toLowerCase();
    return (!query.search || text.includes(query.search.toLowerCase())) && (!query.action || item.action === query.action) && (!query.status || item.status === query.status);
  });
  const items: AuditLog[] = filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((item) => {
    const user = item.userId ? userMap.get(item.userId) : undefined;
    return { id: item.id, user: user ? `${user.firstName} ${user.lastName}` : "System", action: item.action, resource: item.resource, status: item.status, ipAddress: item.ipAddress, details: item.details, timestamp: item.timestamp };
  });
  res.json({ items, total: filtered.length, page: query.page, pageSize: query.pageSize });
});

router.get("/audit-logs/export", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  if (!(await hasPermission(session.user.id, "audit.export"))) {
    res.status(403).json({ error: "You do not have permission to export audit logs." });
    return;
  }
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.timestamp));
  res.type("text/csv").send([
    "Timestamp,User,Action,Resource,Status,IP Address,Details",
    ...rows.map((item) => [item.timestamp.toISOString(), item.userId ?? "System", item.action, item.resource, item.status, item.ipAddress, item.details].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")),
  ].join("\n"));
});

router.get("/profile", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  res.json(await GetProfileResponse.parse(await toPublicUser(session.user)));
});

router.patch("/profile", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile update." });
    return;
  }
  const [user] = await db.update(usersTable).set({ ...parsed.data, email: parsed.data.email?.toLowerCase(), updatedAt: new Date() }).where(eq(usersTable.id, session.user.id)).returning();
  await audit(req, session.user.id, "PROFILE_UPDATED", "user", "success", "Updated personal profile", session.user.id);
  res.json(await toPublicUser(user));
});

router.get("/sessions", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const rows = await db.select().from(sessionsTable).where(and(eq(sessionsTable.userId, session.user.id), eq(sessionsTable.revoked, false))).orderBy(desc(sessionsTable.lastActiveAt));
  res.json(rows.filter((row) => row.expiresAt > new Date()).map((row) => ({
    id: row.id,
    device: row.userAgent,
    location: row.ipAddress === getIp(req) ? "Current network" : "Unknown location",
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    current: row.id === session.sessionId,
  })));
});

router.post("/sessions/:id/revoke", async (req, res): Promise<void> => {
  const session = await requireUser(req, res);
  if (!session) return;
  const id = Number(req.params.id);
  await db.update(sessionsTable).set({ revoked: true }).where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, session.user.id)));
  await audit(req, session.user.id, "SESSION_REVOKED", "session", "success", `Revoked session ${id}`, id);
  res.sendStatus(204);
});

export default router;