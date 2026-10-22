# Deployment & Infrastructure Guide
**Platform:** Malaysia → Bangladesh Cross-Border Pre-Order Application  
**Technology Stack:** Next.js (App Router, Turbopack), Node.js, PostgreSQL, Prisma ORM, TypeScript  
**Version:** Production Readiness Specification (October 2026)  

---

## 1. Hosting Architecture & Target Platforms

The application is built on the Next.js App Router and Node.js runtime, utilizing PostgreSQL for persistence.

### Recommended Production Deployment Options:
1. **Containerized Linux / PaaS (Recommended):**
   - **Render / Railway / Fly.io / AWS ECS / Google Cloud Run** running a standard Docker container or Node.js runtime (`node:20-alpine` or `node:22-alpine`).
   - Advantage: Direct support for streaming responses, Next.js background workers, persistent background tasks, and low database connection overhead.
2. **Serverless (Vercel / Netlify):**
   - Fully compatible with App Router.
   - Requirement: **Must** use a pooled PostgreSQL connection (`DATABASE_URL` pointing to PgBouncer, Supabase connection pooler, or AWS RDS Proxy) to prevent connection exhaustion.

---

## 2. Production Database Provisioning & Migrations

### Prisma Migration Policy:
> [!CRITICAL]
> **NEVER** run `prisma migrate dev` or `prisma migrate reset` in staging or production. Running `migrate dev` or `reset` can drop tables and permanently destroy business data.

### Correct Production Workflow:
1. **Provision Managed PostgreSQL 15+** with automatic backups and multi-AZ failover (e.g. AWS RDS, DigitalOcean Managed PostgreSQL, Supabase, Neon).
2. **Set Environment Variable:**
   ```bash
   DATABASE_URL="postgresql://user:password@db-host:5432/malaysia_preorder?sslmode=require"
   ```
3. **Execute Production Migration Command:**
   ```bash
   npm run db:migrate:deploy
   # Underlying: prisma migrate deploy
   ```
   `prisma migrate deploy` executes all pending unapplied migration files in `prisma/migrations/` sequentially without attempting to modify the schema or prompt for resets.
4. **Verify Migration Status:**
   ```bash
   npm run db:status
   ```

### Seeding Policy in Production:
- The standard `npm run db:seed` script contains test mock accounts and sample catalog items intended for development.
- **Do not run `db:seed` in production.**
- To configure default trade settings and seed the first Super Administrator, follow Section 4 below.

---

## 3. Storage Configuration (S3 / R2)

In production, cross-border customer inquiries and order receipts must not be stored on the local filesystem (which is ephemeral in containerized/serverless environments).

1. Create a dedicated private bucket on **AWS S3** (or **Cloudflare R2** / **MinIO**).
2. Provide standard S3 credentials in environment variables:
   - `STORAGE_ENDPOINT` (e.g., `https://s3.ap-southeast-1.amazonaws.com` or Cloudflare account endpoint)
   - `STORAGE_BUCKET_NAME`
   - `STORAGE_ACCESS_KEY_ID`
   - `STORAGE_SECRET_ACCESS_KEY`
   - `STORAGE_REGION`
   - `STORAGE_PUBLIC_URL_PREFIX` (Optional CDN domain pointing to the bucket)
3. If credentials are left as placeholders, the storage subsystem defaults to safe disabled mode and informs the administrator via `/admin/settings` without faking successful uploads.

---

## 4. First Administrator Provisioning

To safely create the initial Super Administrator without committing credentials or exposing accounts:

Run the provisioning script via CLI with one-time environment variables:
```bash
ADMIN_EMAIL="superadmin@yourcompany.com" \
ADMIN_PASSWORD="StrongTemporaryPassword123!" \
ADMIN_NAME="Operations Director" \
ADMIN_PHONE="+8801800000000" \
npm run provision:admin
```
- Hashes password using bcrypt.
- Assigns role `ADMIN` and creates the associated double-entry `WalletAccount`.
- Once logged in at `/admin/login`, the administrator should immediately rotate their password in `/account`.

---

## 5. Build and Startup Commands

In your CI/CD deployment pipeline or `Dockerfile`:

### Production Build:
```bash
# 1. Install exact production dependencies
npm ci

# 2. Generate Prisma Client
npx prisma generate

# 3. Compile Next.js production build
npm run build
```

### Production Execution:
```bash
# 1. Run pending database migrations
npm run db:migrate:deploy

# 2. Start HTTP server
npm run start
```
By default, the server binds to `0.0.0.0` on port `PORT` (default: 3000).

---

## 6. Health & Readiness Probes

A dedicated zero-auth health endpoint is available at:
`GET /api/health`

### Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-22T17:45:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "latencyMs": 4
    },
    "runtime": {
      "status": "healthy",
      "nodeVersion": "v20.18.0"
    }
  }
}
```
- **HTTP 200**: Database connection verified; instance ready to receive traffic.
- **HTTP 503**: Database ping failed; orchestrator should stop routing traffic to this replica.

Configure this path in Kubernetes (`livenessProbe` / `readinessProbe`) or cloud load balancers (AWS ALB / GCP Health Checks).

---

## 7. Security & Network Protections

1. **HTTPS Enforcement:** Terminate TLS 1.3 at your edge reverse proxy (Cloudflare, AWS CloudFront, or NGINX). Enforce HSTS headers.
2. **Secure Session Cookies:** 
   - Cookie name: `mb_auth_session`
   - Attributes: `HttpOnly`, `SameSite=Lax`, `Secure` (automatically activated when `NODE_ENV=production`).
3. **CORS & Trusted Origins:** API endpoints only accept cross-origin requests from `NEXT_PUBLIC_APP_URL`.
4. **Rate Limiting:** Protect `/api/auth/me`, `/api/auth/password-reset`, and `/api/inquiries` using the built-in sliding window limiter in `lib/security/rate-limit.ts`.
5. **No Secrets in Logs:** The payload sanitizer in `lib/payments/sanitizer.ts` strips CVVs, card numbers, passwords, and API keys before logging or writing audit trails.

---

## 8. Backups, Restore Testing & Incident Response

### Database Backup Strategy:
- **Point-in-Time Recovery (PITR):** Enable WAL archiving and automated daily snapshots with minimum 30-day retention on the managed PostgreSQL instance.
- **Physical Dump Test:** Schedule monthly drills executing `pg_dump` and restoring to an isolated staging instance to verify snapshot integrity:
  ```bash
  pg_dump -Fc "$DATABASE_URL" > backup-dr-test.dump
  ```

### Incident Response Playbook:
1. **Suspected Payment Discrepancy:** Inspect `/admin/reports` and `/admin/payments`. If duplicate callbacks or tampering occur, verify the `WebhookEvent` table for signature failures.
2. **Wallet Discrepancy Alert:** If `/admin/reports` flags `isReconciled: false`, check `/admin/wallet` to review individual `WalletLedgerEntry` rows. The ledger is append-only; fix any balance anomaly using compensating ledger entries, never direct SQL edits.
