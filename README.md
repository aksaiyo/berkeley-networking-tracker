# BearLink — Secure Networking Tracker

BearLink is a private networking tracker for the people you want to stay connected with at Berkeley. It combines a responsive React interface, a Node.js API, Neon Managed Better Auth, the Neon Data API, and PostgreSQL row-level security so each user can see and change only their own contacts.

> **Live app:** Add the production Vercel URL here after deployment.

## Product walkthrough

1. Create an account or sign in with email and password.
2. Add a contact with their name, company, role, where you met, notes, and priority.
3. Search, filter, or sort the private contact list.
4. Edit or delete a contact; refresh the browser to confirm the record persists.
5. Sign out from the account control in the header.

Add the required production screenshots here after connecting Neon and deploying:

- Sign-in and sign-out
- Creating, editing, deleting, and refreshing a contact
- Invalid input showing a safe error
- Two-account privacy verification

## Features

- Email/password sign-up, sign-in, session handling, and sign-out
- Private contact creation, viewing, editing, and deletion
- Search by name, company, or role
- Priority filtering and sorting by date, name, company, or priority
- Responsive desktop table and mobile cards
- Clear loading, empty, success, validation, and error states
- Shared frontend/backend Zod validation
- PostgreSQL constraints and RLS as defense in depth
- Automated validation tests

## Technology stack

- **React 19 + Vite + TypeScript:** fast, typed client development
- **Tailwind CSS:** responsive design system and consistent visual tokens
- **TanStack Query:** server-state loading, caching, mutation, and refresh behavior
- **Node.js serverless functions:** trusted validation and a separated backend API
- **Neon Managed Better Auth:** managed user accounts and short-lived JWTs
- **Neon Data API:** HTTPS access to Postgres without exposing a connection string
- **Neon Postgres RLS:** database-enforced per-user ownership
- **Vitest:** fast automated validation tests
- **Vercel:** SPA and Node function hosting in one project

## Architecture and request flow

```text
React UI ── sign in ──────────────> Neon Managed Better Auth
   │                                      │
   │ short-lived JWT                      │ identity claim
   ▼                                      ▼
Node /api/contacts ── JWT ────────> Neon Data API ──> Postgres
                                                        │
                                                        └─ RLS checks auth.user_id()
```

The browser uses only the public HTTPS Auth and Data API endpoint names. Contact mutations go through Node so untrusted form data is validated before it reaches Neon. The Node API forwards the user's JWT to the Data API; it never uses a privileged database connection for application CRUD. PostgreSQL RLS independently limits every returned or changed row.

## Local setup

Prerequisites: Node.js 20+, pnpm or npm, and a Neon project with Managed Better Auth and the Data API enabled.

```bash
git clone <your-public-repository-url>
cd <repository-directory>
pnpm install
cp .env.example .env.local
```

1. In Neon, enable Managed Better Auth with email/password authentication.
2. Enable the Data API with Neon Auth authentication.
3. Run `database/migrations/001_create_contacts.sql` in the Neon SQL editor.
4. Put the branch's public Auth and Data API HTTPS URLs in `.env.local`.
5. Add `http://localhost:5173` to Neon Auth trusted origins.
6. Run the frontend with `pnpm dev`.
7. For local end-to-end API testing, install the Vercel CLI and run `vercel dev`; it serves both Vite and `/api` functions.

## Environment variables

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_NEON_AUTH_URL` | Browser-safe | Branch-specific Neon Auth HTTPS endpoint |
| `NEXT_PUBLIC_NEON_DATA_API_URL` | Browser-safe | Branch-specific Neon Data API `/rest/v1` endpoint |
| `DATABASE_URL` | Server-only | Applying SQL migrations; never used by browser code |
| `NEON_AUTH_BASE_URL` | Server-only, optional | Reserved for a future server-side Auth integration |
| `NEON_AUTH_COOKIE_SECRET` | Server-only, optional | Reserved for signed server-side session cookies |

Never prefix `DATABASE_URL` or any secret with `NEXT_PUBLIC_`. Real `.env.local` files are ignored by Git.

## Database schema

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key, generated automatically |
| `user_id` | `text` | Required, defaults to `auth.user_id()` |
| `name` | `text` | Required and cannot be blank |
| `company` | `text` | Optional |
| `role` | `text` | Optional |
| `where_met` | `text` | Optional |
| `notes` | `text` | Optional |
| `priority` | `text` | Required; only `high`, `medium`, or `low` |
| `created_at` | `timestamptz` | Defaults to the current time |
| `updated_at` | `timestamptz` | Updated automatically by a trigger |

### Authentication, ownership, and RLS

RLS is enabled and forced on `contacts`. Four separate policies apply to the `authenticated` role:

- `SELECT` uses `auth.user_id() = user_id`.
- `INSERT` uses `WITH CHECK (auth.user_id() = user_id)`.
- `UPDATE` uses the ownership condition in both `USING` and `WITH CHECK`, preventing ownership transfer.
- `DELETE` uses `auth.user_id() = user_id`.

The API never accepts `user_id` in its validation schema. Postgres fills it from the verified JWT and RLS rejects cross-user access even if someone crafts a direct HTTP request.

## Tests

```bash
pnpm test
pnpm build
```

The automated suite verifies that empty names and invalid priorities fail, valid records are normalized, and empty update payloads are rejected. After running it, paste a screenshot of the passing output here for grading evidence.

### Two-account privacy verification

1. Sign in as User A and create a uniquely named contact.
2. Save the contact's UUID from the successful Data API response in browser developer tools.
3. Sign out and sign in as User B.
4. Confirm User A's record is absent from the list.
5. As User B, send `PATCH` and `DELETE` requests for User A's UUID with User B's JWT.
6. Confirm no row is returned or changed.
7. Sign back in as User A and confirm the contact remains unchanged.

Record sanitized screenshots or a short recording of this test and add them to the walkthrough section. Do not capture tokens, cookies, connection strings, or secrets.

## Deploy to Vercel

1. Push this repository to a public GitHub repository.
2. Import the repository into Vercel; the included `vercel.json` selects Vite and Node.js 22 for the API functions.
3. Add `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL` in Vercel project settings.
4. Do not add `DATABASE_URL` unless a server-only migration workflow explicitly needs it.
5. Deploy and add the resulting production domain to Neon Auth trusted origins.
6. Open the production URL in a private window and repeat the functional and two-user privacy checks.
7. Add the live URL and sanitized evidence to this README.

## Known limitations and next improvements

- Lists are not paginated; cursor pagination would be the next step for large networks.
- Email verification and password-reset behavior depend on the Neon Auth configuration.
- Tests cover trusted validation; a dedicated Neon test branch would enable automated end-to-end RLS tests.
- There are no reminders, sharing, or team workspaces because they are outside this assignment's scope.
