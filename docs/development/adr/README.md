# Architecture Decision Records

Concise records for the decisions genuinely worth explaining — not
bureaucracy for trivial choices. Each one states the real trade-off
made and what it costs, not just what was picked.

- [ADR-0001: MongoDB via Mongoose, with an in-memory fallback](0001-mongodb-with-in-memory-fallback.md)
- [ADR-0002: Tenant isolation via `AsyncLocalStorage`](0002-tenant-isolation-via-async-local-storage.md)
- [ADR-0003: A MongoDB-backed scheduler as the queue, not Redis/BullMQ](0003-queue-architecture.md)
- [ADR-0004: Vercel serverless deployment, no Docker/Kubernetes](0004-vercel-serverless-deployment.md)
- [ADR-0005: Four separate per-purpose credential encryption keys](0005-per-purpose-credential-encryption-keys.md)
- [ADR-0006: Global Plan catalog + per-organization Subscription + reversible overrides](0006-plan-entitlement-architecture.md)
