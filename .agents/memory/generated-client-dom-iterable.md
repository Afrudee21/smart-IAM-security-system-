---
name: Generated client DOM iterable support
description: Shared generated fetch clients may use Headers.entries during typechecking.
---

Generated API clients can rely on iterable DOM APIs such as `Headers.entries()`, so composite client libraries need both `dom` and `dom.iterable` in their TypeScript lib settings.

**Why:** The generated client compiled successfully but the workspace typecheck failed until iterable DOM types were enabled.

**How to apply:** When OpenAPI codegen introduces `Headers` or other iterable DOM API errors, check the shared client library tsconfig before changing generated files.