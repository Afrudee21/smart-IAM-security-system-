# System Architecture

The React/Vite web app calls the shared Express API through `/api`. The API validates request bodies with generated Zod schemas, evaluates cookie sessions, checks permissions through role mappings, runs the risk engine, writes audit events, and persists records in PostgreSQL through Drizzle ORM.

```mermaid
flowchart LR
  UI[React UI] --> API[Express API]
  API --> S[Auth + Session Service]
  API --> A[Authorization Service]
  API --> R[Risk + Alert Service]
  API --> L[Audit Logger]
  S --> DB[(PostgreSQL)]
  A --> DB
  R --> DB
  L --> DB
```
