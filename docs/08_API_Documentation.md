# API Documentation

The canonical endpoint contract lives in `lib/api-spec/openapi.yaml` and the human-readable endpoint table is in `API_DOCUMENTATION.md`. Generated React Query hooks and Zod schemas are rebuilt with:

```bash
pnpm --filter @workspace/api-spec run codegen
```
