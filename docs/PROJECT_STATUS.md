# Project Status & Environment Audit

**Date:** 2026-10-22  
**Project:** Malaysia → Bangladesh Pre-Order Platform (`malaysia-preorder`)  
**Working Directory:** `/Users/prayangshuuu/Desktop/malaysia-preorder`

---

## 1. Executive Summary

An initial architectural and environment audit was conducted for the Malaysia → Bangladesh pre-order project. The repository is a fresh Next.js App Router project configured with TypeScript, Tailwind CSS, and Turbopack. No business logic or database schema has been created yet.

All baseline lint, typecheck, and build checks pass successfully.

---

## 2. Detected Versions & Environment Stack

| Component | Detected Version | Details / Source |
|---|---|---|
| **Node.js** | `v26.7.0` | Active runtime |
| **npm** | `11.19.0` | Active package manager |
| **Next.js** | `16.4.2` | Turbopack enabled, App Router (`app/`) |
| **React / React DOM** | `19.3.0` | React 19 Canary / latest branch |
| **TypeScript** | `^5` (5.x) | Bundler module resolution, strict mode |
| **Tailwind CSS** | `^4` (v4 with Turbopack loader) | `@tailwindcss/turbopack` |
| **Prisma CLI** | `8.0.0-rc.23` | Installed in project `devDependencies` |
| **Prisma Client** | `^7.10.1` | Installed in project `dependencies` (version mismatch detected) |
| **PostgreSQL** | PostgreSQL 16 (`psql (PostgreSQL) 16.x`) | Installed via Homebrew, actively running on port 5432 (`/tmp:5432`) |
| **Docker** | `29.6.0` (Colima context) | Running with active container daemon |

---

## 3. Findings & Stray Packages Outside Project

### Stray Node Modules in Home Directory (`~`)
During inspection, files installed outside the project directory were detected at `/Users/prayangshuuu`:
- `/Users/prayangshuuu/package.json`
- `/Users/prayangshuuu/package-lock.json`
- `/Users/prayangshuuu/node_modules/` (275 packages)

**Installed dependencies in `~/package.json`:**
```json
{
  "dependencies": {
    "@prisma/client": "^7.10.1",
    "openapi-to-md": "^1.1.1",
    "pptxgenjs": "^4.0.1",
    "sharp": "^0.35.4"
  },
  "devDependencies": {
    "prisma": "^8.0.0-rc.23"
  }
}
```
**Impact:** Next.js build emits a warning:
> `⚠ Warning: Next.js ignored package-lock.json in /Users/prayangshuuu because it is outside the current Git repository`

*(Note: Per the safety protocol, nothing outside the project directory has been deleted.)*

---

## 4. Prisma Analysis & Command Syntax Audit

### Version Mismatch
- `devDependencies`: `prisma@^8.0.0-rc.23`
- `dependencies`: `@prisma/client@^7.10.1`

On npm, Prisma published `8.0.0-rc.23` under the `latest` tag for the CLI package `prisma`, but the stable release of `@prisma/client` is `7.10.1`.

### Initialization Syntax Audit (Prisma 8 vs Outdated Commands)
- **Outdated command (DO NOT RUN):**
  ```bash
  npx prisma init --datasource-provider postgresql
  ```
  *In Prisma 8, `prisma init` does not accept `--datasource-provider` and is reserved for configuring AI skills and repo hooks.*
- **Correct Prisma 8 initialization syntax:**
  ```bash
  npx prisma orm init --target postgres --authoring psl --yes
  ```
  *(Or if aligning to Prisma 7 stable across both client and CLI: `npm install -D prisma@7.10.1 @prisma/client@7.10.1` followed by `npx prisma init`)*.

---

## 5. Completed Setup Actions

1. **Git Configuration:**
   - Added `MASTER_PROMPT.md` and `master_promt.nd` to `.gitignore`.
   - Added `!.env.example` exception and `.idea/` to `.gitignore`.
   - Unstaged `MASTER_PROMPT.md` from git tracking without modifying its on-disk content.
2. **Environment Template (`.env.example`):**
   - Created `.env.example` containing placeholders for:
     - Application settings (`NODE_ENV`, `NEXT_PUBLIC_APP_URL`)
     - PostgreSQL database connection (`DATABASE_URL`)
     - Authentication (`AUTH_SECRET`, `AUTH_URL`)
     - Object storage (`STORAGE_ENDPOINT`, `STORAGE_BUCKET_NAME`, etc.)
     - Payment providers (bKash sandbox placeholders, SSLCommerz)
     - Email/SMTP notification placeholders
   - Verified no credentials or secrets are committed.

---

## 6. Build & Verification Results

| Command | Status | Output / Findings |
|---|---|---|
| `npm run lint` | **PASS** | ESLint executed with no errors or warnings. |
| `npx tsc --noEmit` | **PASS** | TypeScript type check passed cleanly with 0 errors. |
| `npm run build` | **PASS** | Next.js 16.4.2 Turbopack production build compiled successfully in 1.4s. Generated static pages for `/` and `/_not-found`. |

---

## 7. Blockers & Next Steps

### Decision Required: Prisma Version Alignment
- Recommend pinning either:
  1. Prisma 7 LTS / Stable: `prisma@7.10.1` + `@prisma/client@7.10.1` (recommended for production stability with Next.js 16), or
  2. Prisma 8 Toolchain: using `prisma orm init --target postgres --authoring psl`.

### Upcoming Implementation Phases (Per `MASTER_PROMPT.md`)
1. Decide on Prisma version alignment and initialize database schema.
2. Configure local PostgreSQL database (`malaysia_preorder`) and verify connection.
3. Propose and configure the authentication solution (NextAuth / Auth.js) before implementing customer and admin roles.
4. Model the domain schemas (Users, Inquiries, Quotes, Orders, Payments, Wallet Ledger, Procurements, Shipments).
5. Build features incrementally following the modular monolith architecture.
