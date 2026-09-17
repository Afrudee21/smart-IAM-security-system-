# Smart IAM Security Platform

An enterprise-style identity and access management console with RBAC, MFA, risk monitoring, security alerts, sessions, and audit trails.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/smart-iam run dev` — run the Smart IAM web console
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Replit-managed PostgreSQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/smart-iam` — React/Vite web console and visual system
- `artifacts/api-server` — Express API, IAM routes, session, risk, and audit services
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/iam.ts` — PostgreSQL schema
- `README.md`, `API_DOCUMENTATION.md`, and `docs/` — project documentation

## Architecture decisions

- Cookie sessions are used because this browser console needs revocation and active-session visibility.
- Passwords, session tokens, and MFA codes are hashed with Node crypto before persistence.
- The synthetic simulator creates database-backed events and alerts without performing real-world security actions.
- OpenAPI is the contract for both server validation and generated frontend hooks.

## Product

The console supports authentication and MFA, least-privilege RBAC, user/role/permission administration, risk-based monitoring, alert resolution, session controls, and auditable CSV exports.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The API seeds demo data on the first start; do not run the seed path against an existing production database.
- Development MFA returns a temporary OTP in the response so the demonstration works without an email provider.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
