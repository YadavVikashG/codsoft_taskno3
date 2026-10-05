# CareerHub

A Next.js recruitment portal with candidate job discovery, saved roles, application tracking, recruiter job publishing, candidate pipeline controls, resume uploads, member profiles, friend connections, company follows, and a community feed.

## Run locally

```sh
npm install
npm run dev
```

## Accounts and roles

Candidates and recruiters create accounts from the sign-in screen. Recruiters register their company; their jobs and applicant pipeline are private to their team. Candidates can save roles, upload a private resume, apply, and track status. Admin accounts are never available through public registration.

To provision the first administrator, run `npm run admin:create` in an interactive terminal. Enter the admin email and a unique password when prompted; password input is hidden. Admins can review account totals, promote or demote roles, suspend accounts, and oversee listings and applications. Never commit `.env.local`, and rotate any database credential shared outside your deployment secret store.

Each account uses a PostgreSQL-backed, HTTP-only session. API routes enforce account role and record ownership. Uploaded resumes are private and only available to their owner, the recruiter handling an application, or an administrator.

### Google sign-up and sign-in

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env.local` and your deployment's secret store. Register the exact redirect URI `http://localhost:3000/api/auth/google/callback` for local development and the HTTPS equivalent for production in Google Cloud. Google OAuth apps in testing mode only allow configured test users. New accounts use the selected candidate or recruiter role; recruiter sign-up also requires a company name. Existing accounts retain their current role when signing in with the same verified Google email.

## PostgreSQL

Create a database, copy `.env.example` to `.env.local`, set `DATABASE_URL`, and run the schema:

```sh
psql "$DATABASE_URL" -f db/schema.sql
```

The API uses PostgreSQL for accounts, sessions, job listings, saved roles, applications, and recruiter pipelines. Resume uploads use private local files by default.

Member profiles support education, certificates, and current work details. The Community view provides member discovery, friend requests, accepted-friend messaging, company follows, and posts with likes, comments, and shares. Direct messages are available only after a friend request is accepted. For an existing database, apply the additive profile and community schema with `psql "$DATABASE_URL" -f db/schema.sql`.

## Cloud resume storage

Set `S3_BUCKET`, `S3_REGION`, and credentials in `.env.local` to use AWS S3. For Cloudflare R2 or another S3-compatible provider, also set `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Resumes and Community post images use this bucket when configured. Post images support JPEG, PNG, WebP, or GIF up to 5 MB; without a bucket, they use private local storage.

## Checks

```sh
npm run typecheck
npm run build
```# CODSOFT_TASKSNO3
# CODSOFT_TASKSNO3
# CODSOFT_TASKSNO3
# codsoft_taskno3
