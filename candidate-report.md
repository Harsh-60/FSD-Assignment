# Candidate Engineering Report

**Candidate:** Harsh-60  
**Date:** 2026-07-15  
**Repository:** https://github.com/Harsh-60/FSD-Assignment

---

## 1. Executive Summary

BugForge is a monorepo project-management application with a Next.js frontend and an Express + MongoDB backend. After cloning and performing a thorough code review, I identified and fixed **7 defects** spanning security, performance, correctness, and operational reliability. All fixes were made incrementally with descriptive commits, without removing features or weakening security controls. The project now passes all lint, typecheck, and automated tests.

---

## 2. Issues Found, Severity, Impact, and Root Cause

### Issue 1 — Plaintext Password Logged on Login (CRITICAL — Security)

**File:** `apps/api/src/controllers/auth-controller.ts` (line 25)

**Root Cause:** The `login` handler logged `req.log.info({ email, password }, ...)`, including the user's raw password in structured application logs.

**Impact:** Any log aggregation system (Datadog, CloudWatch, Splunk, etc.) would store plaintext user passwords. A log breach exposes all users' credentials and violates GDPR/OWASP standards.

**Fix:** Removed `password` from the log payload. Only `email` is logged.

---

### Issue 2 — Task Updates Accepted Arbitrary Unvalidated Body (HIGH — Security/Correctness)

**File:** `apps/api/src/controllers/task-controller.ts` (line 51)

**Root Cause:** `updateTask` cast `req.body` to `Record<string, unknown>` and passed it directly to `findByIdAndUpdate`. This bypassed all schema validation and allowed arbitrary fields (including `project`, `createdBy`, `_id`) to be written to the database.

**Impact:** An authenticated user could overwrite sensitive fields like `project` (moving a task to another project they don't own) or inject unexpected fields, leading to data corruption.

**Fix:** Applied `taskSchema.partial().parse(req.body)` to strip any fields not defined in the schema, enforcing the allowed update fields and their types.

---

### Issue 3 — Infinite Render Loop on Dashboard Page (HIGH — Performance)

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

**Root Cause:** A `useEffect` had `renderVersion` in its dependency array, and its body called `setRenderVersion(renderVersion + 1)`. This created an infinite cycle: state change → re-render → effect fires → state change → ...

**Impact:** The dashboard page would immediately peg the browser's CPU to 100% and freeze the UI for any logged-in user.

**Fix:** Removed the `renderVersion` state variable and the associated `useEffect` entirely. The variable served no functional purpose.

---

### Issue 4 — XSS Vulnerability via `dangerouslySetInnerHTML` (HIGH — Security)

**File:** `apps/web/app/(dashboard)/projects/page.tsx` (line 72)

**Root Cause:** Project descriptions fetched from the API were rendered using `dangerouslySetInnerHTML`. If a user stored `<script>alert(1)</script>` or a malicious `<img onerror=...>` in their project description, it would execute in all visitors' browsers.

**Impact:** Stored Cross-Site Scripting (XSS). An attacker who can create or edit a project could steal session tokens from other members.

**Fix:** Replaced `dangerouslySetInnerHTML` with standard React text interpolation `{project.description}`. Descriptions are now rendered as safe plain text.

---

### Issue 5 — N+1 Query and Incorrect Statistics in Dashboard (MEDIUM — Performance/Correctness)

**File:** `apps/api/src/controllers/dashboard-controller.ts`

**Root Cause (N+1):** The dashboard performed one DB query per project to count completed tasks: `projects.map(project => TaskModel.countDocuments(...))`. With N projects, this caused N+1 database round-trips.

**Root Cause (Correctness):** The query applied `.limit(6)` before counting completed tasks, meaning only the 6 most recently updated projects' tasks were counted in `completedTasks`, not all of the user's projects.

**Impact:** Performance degrades linearly with project count. The "Completed work" statistic shown on the dashboard was inaccurate for users with more than 6 projects.

**Fix:** Fetched all user projects first (without limit), sliced the top 6 for display, then ran a single `TaskModel.countDocuments({ project: { $in: allProjectIds } })` across all project IDs.

---

### Issue 6 — Express Error Handler Not Registered Due to Wrong Arity (MEDIUM — Reliability)

**File:** `apps/api/src/middleware/error.ts`

**Root Cause:** Express identifies error-handling middleware by the function's arity (number of declared parameters). The `errorHandler` function only declared 3 parameters `(error, _req, res)`, so Express treated it as regular middleware and never invoked it for errors. Uncaught errors would result in no response to the client and a potential Node.js crash.

**Impact:** Any unhandled error (DB connection loss, unexpected exception) would hang the HTTP request indefinitely or crash the process without returning a proper error response.

**Fix:** Added the required 4th parameter `_next` to the function signature: `(error, _req, res, _next)`. Also updated the ESLint config to allow the `argsIgnorePattern: '^_'` convention to prevent lint errors for intentionally unused parameters.

---

### Issue 7 — `setInterval` Memory Leak in Notification Polling (LOW — Reliability)

**File:** `apps/web/components/app-shell.tsx` (line 29)

**Root Cause:** A `setInterval` was started inside `useEffect` but the effect returned no cleanup function. Each time the `AppShell` component unmounted and remounted (e.g., during navigation or hot reloads in development), a new interval was created without clearing the old one.

**Impact:** In development, rapid navigation would accumulate dozens of polling intervals. In production, if the component re-mounts, stale intervals continue firing API requests against potentially expired sessions, causing unnecessary server load and console errors.

**Fix:** Stored the interval reference and returned `() => clearInterval(interval)` from the effect.

---

## 3. Additional Improvements

- **Missing Comment Edit/Delete API Routes:** The `comment-controller.ts` implemented `updateComment` and `deleteComment` handlers, but no routes exposed them in `routes/index.ts`. Added `PATCH /comments/:commentId` and `DELETE /comments/:commentId`.

- **Async Middleware Error Propagation:** Async middleware functions (`requireProjectAccess`, `requireTaskAccess`) were not wrapped in `asyncHandler`. A DB error inside them would result in an unhandled promise rejection. Wrapped all async middleware uniformly using `asyncHandler`.

- **Cross-Platform Lint Script:** The web `lint` script used `ESLINT_USE_FLAT_CONFIG=false` as a Linux-only inline env var. Added `cross-env` as a devDependency so the script works on Windows and Linux/Mac equally.

---

## 4. Tests and Manual Verification

### Automated Tests Added

- `tests/auth-schemas.test.ts` — 7 tests covering `registerSchema` and `loginSchema` validation.
- `tests/task-project-schemas.test.ts` — 15 tests covering `taskSchema` (including partial schema for PATCH), `projectSchema`, all enum values, and boundary conditions.

**Test Results:** 24 tests across 3 files — all pass.

### Commands Used to Verify

```bash
npx pnpm install       # OK
npx pnpm typecheck     # OK - no type errors
npx pnpm lint          # OK - no warnings
npx pnpm test          # OK - 24/24 tests passing
```

---

## 5. Remaining Risks and Recommended Follow-Up Work

| Risk                                                                       | Severity | Recommendation                                                                                                              |
| -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| No rate limiting on auth endpoints                                         | HIGH     | Add `express-rate-limit` to `/auth/login` and `/auth/register` to prevent brute-force attacks.                              |
| Access tokens stored in `localStorage`                                     | MEDIUM   | `localStorage` is vulnerable to XSS. Consider migrating to `httpOnly` cookies for token storage.                            |
| No input sanitization on free-text fields (task description, comment body) | MEDIUM   | Apply a library like `DOMPurify` server-side on write if HTML rendering is ever needed, or validate/strip on ingest.        |
| No integration or E2E tests                                                | MEDIUM   | Add integration tests using `supertest` + `mongodb-memory-server` to test the API routes end-to-end without a real DB.      |
| CORS is open to all origins                                                | MEDIUM   | `cors({ origin: (_origin, cb) => cb(null, true) })` allows any domain. Restrict to the known frontend origin in production. |
| No HTTPS / TLS in Docker Compose                                           | MEDIUM   | Production setup should terminate TLS at the nginx layer with a real certificate (e.g., Let's Encrypt).                     |
| `pnpm-lock.yaml` references pnpm 9.15.9 but 11.x installed via npx         | LOW      | Pin pnpm version in CI or install it globally to ensure lock file consistency.                                              |
