# Testing

The project validates the shared libraries, server, and web artifact with TypeScript checks and builds. The verified smoke path covers demo login, dashboard stats, MFA challenge and verification, employee access denial, synthetic high-risk event generation, session state, and CSV audit export.

```bash
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/smart-iam run typecheck
pnpm --filter @workspace/api-server run build
```
