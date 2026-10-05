# How to Start Developing This Web App

This is a hands-on guide to CareerHub, a job-search and recruitment web app. The easiest way to learn it is to get it running first, then follow one feature from the screen to its API route and database query. You do not need to understand every file before you begin.

## 1. What the app uses

- Next.js 15 with the App Router
- React 19 and TypeScript
- PostgreSQL, accessed with `pg`
- Cookie-based accounts and sessions
- Optional S3-compatible file storage, including AWS S3 and Cloudflare R2
- Plain CSS in `app/globals.css`, with Lucide icons

The main page is a client-side portal. Its smaller feature components live in `components/`. Server endpoints live under `app/api/`, and shared database, authentication, theme, job, and type code lives in `lib/`.

## 2. Get the project running

### Install the tools

Install Node.js (a current LTS release is a good choice), npm, Git, and PostgreSQL. You also need `psql`, the PostgreSQL command-line client, to apply the database schema.

Check that the tools are available:

```sh
node --version
npm --version
git --version
psql --version
```

### Get the code and install packages

If the code is already open in your editor, start in its project folder. Otherwise, clone the repository and enter the folder:

```sh
git clone <repository-url>
cd <repository-folder>
npm install
```

The `package-lock.json` file records the installed dependency versions. Keep it in the repository and use `npm install` when package dependencies change.

### Configure PostgreSQL

Create a local database named `careerhub`, then make a local environment file:

```sh
createdb careerhub
cp .env.example .env.local
```

Open `.env.local` and set `DATABASE_URL` to the connection string for your own PostgreSQL installation. The example value is only a local example; your username, password, host, or port may be different.

Apply the schema:

```sh
psql "$DATABASE_URL" -f db/schema.sql
```

The schema creates users, sessions, jobs, applications, messaging, community, and support tables. It also includes compatibility `ALTER TABLE` statements and removes a few old sample job IDs. Do not run it against production without reviewing every statement first. For production changes, use a reviewed migration and back up the database.

### Start the app

```sh
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`. Stop the server with `Ctrl+C`.

Without `DATABASE_URL`, the app can show some limited empty states, but accounts and database-backed features will not work. Set up PostgreSQL before trying the full workflows.

## 3. Create a development admin

Public registration only allows candidate and recruiter accounts. Admin accounts must be created separately. With `DATABASE_URL` configured, run this from an interactive terminal:

```sh
npm run admin:create
```

Enter an email address and a password of at least 10 characters when prompted. The password is hidden while typing. The script can promote an existing account with that email to admin, so use it carefully and only with an account you control.

## 4. Find your way around the code

| Location | What it does |
| --- | --- |
| `app/page.tsx` | Main portal, view navigation, data loading, and much of the client-side interaction |
| `app/globals.css` | Global layout, components, responsive rules, and theme styling |
| `app/layout.tsx` | Root HTML layout and page metadata |
| `components/auth-screen.tsx` | Sign-in and registration screens |
| `components/application-communications.tsx` | Application conversation UI |
| `components/community-center.tsx` | Member, company, and community UI |
| `components/help-center.tsx` | Help and support UI |
| `components/theme-control.tsx` | Theme selection UI |
| `app/api/` | Server-side HTTP route handlers |
| `db/schema.sql` | PostgreSQL tables, indexes, and schema updates |
| `lib/auth.ts` | Password hashing, session lookup, and current-user helpers |
| `lib/db.ts` | PostgreSQL connection pool |
| `lib/jobs.ts` | Shared job type and salary formatting |
| `lib/themes.ts` | Theme definitions and selection helpers |
| `lib/types.ts` | Shared account types |
| `private_uploads/` | Local development storage; ignored by Git |

### API route map

- `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, and `/api/auth/session`: account and session actions
- `/api/jobs`: list, publish, and update job openings
- `/api/applications`: list, submit, and update applications
- `/api/applications/[applicationId]/messages`: application messages and interview details
- `/api/saved-jobs` and `/api/profile`: candidate saved jobs and profile
- `/api/resumes`: private resume upload and authorized download
- `/api/community` and `/api/community/media`: community data, conversations, and image uploads
- `/api/support`: support requests
- `/api/admin/overview` and `/api/admin/users`: admin information and user management

## 5. Understand the main workflows

### Accounts and sessions

`lib/auth.ts` hashes passwords with Node's `scrypt`, creates a random session token, stores only its SHA-256 hash in PostgreSQL, and sets the token in an HTTP-only cookie. `getCurrentUser()` is the usual server-side way for an API route to find the signed-in user.

### Roles

The app has three roles: `candidate`, `recruiter`, and `admin`. Routes should check both that a user is signed in and that their role is allowed. A recruiter should only be able to manage jobs and applications belonging to that recruiter. An admin has broader access. Never rely on hiding a button in React as the only access check; enforce permission on the server too.

### Jobs and applications

Candidates discover and save open jobs, upload a resume, and apply. Recruiters post jobs and manage their candidate pipeline. Application messages support regular messages and hiring events such as interviews and offers. The database uses foreign keys and uniqueness rules to help protect these relationships.

### Uploads

Resume files accept PDF and Word formats up to 5 MB. Community images accept JPEG, PNG, WebP, and GIF up to 5 MB. Local development files go under `private_uploads/`; when `S3_BUCKET` is configured, the app stores files in the configured S3-compatible bucket. Do not make resumes public: the resume route checks the signed-in user's relationship to the resume before returning it.

## 6. Make your first changes

Start with one small change at a time:

1. Pick one visible detail, such as a label, empty state, or spacing rule.
2. Find its component or style in `app/page.tsx`, `components/`, or `app/globals.css`.
3. Change only that behavior or style.
4. Run the app and check the change at desktop and mobile widths.
5. Run the type check and production build before you finish.

For a feature that saves data, trace the whole path before editing: the UI event, the `fetch()` request, the matching `app/api/.../route.ts`, the SQL query, and the response used by the UI. Keep request and response fields consistent across all of those steps.

## 7. Add a feature the reliable way

Use this checklist when adding a data-backed feature:

1. Describe who can use it and what data they own.
2. Decide whether existing tables and routes already cover it.
3. Add or update a PostgreSQL migration if the data shape changes. Keep constraints and indexes where they protect real rules or query performance.
4. Add a route handler under `app/api/`. Check authentication, role, ownership, input types, and reasonable length limits on the server.
5. Use parameterized SQL values such as `$1`, `$2`; do not build a query by joining user input into SQL text.
6. Return a clear status code and JSON response for success and expected failures.
7. Add the UI in the closest existing component. Show loading, empty, success, and error states.
8. Check the feature as each role that can use it, and also test a role that must be denied.
9. Run the project checks and review the final diff before publishing.

For example, a private recruiter action should verify the signed-in user is a recruiter, then include the recruiter ID in the database query so a request cannot change another recruiter's records just by guessing an ID.

## 8. Learning path: beginner to advanced

### Beginner

- Start the app and explore it with candidate and recruiter accounts.
- Learn JSX, React state, TypeScript types, and how browser `fetch()` works.
- Change a label or a theme setting, then trace where its value comes from.
- Learn basic SQL: `SELECT`, `INSERT`, `UPDATE`, foreign keys, and unique constraints.
- Use browser developer tools to inspect network requests and errors.

### Intermediate

- Add a validated form field and persist it through an API route.
- Add loading, empty, success, and failure states to the UI.
- Add a database column with a migration and keep API types in sync.
- Add ownership checks and test candidate, recruiter, and admin access separately.
- Break a large UI responsibility into a focused component when that makes it easier to maintain.
- Learn Git branches and small commits so each change is easy to review or undo.

### Advanced

- Design indexes from real query patterns and inspect slow queries with PostgreSQL tools.
- Use database transactions when a workflow must update multiple related records together.
- Add automated tests for route permissions, validation, and important user workflows; this repository currently has no test script, so choose a test framework and document how to run it before relying on it.
- Add structured logging and monitoring without recording passwords, session tokens, resume contents, or other private data.
- Review upload limits, content validation, storage access, session expiry, rate limits, and CSRF protections before a public launch.
- Move production uploads to durable private object storage. Local filesystem uploads may disappear when a hosting instance is replaced or redeployed.
- Plan backups, schema migrations, rollback steps, and least-privilege database credentials before changing production data.

## 9. Checks and manual testing

The project currently provides these package scripts:

```sh
npm run typecheck
npm run build
npm run lint
```

There is no automated test command in `package.json` yet. Until tests are added, manually check a small core flow after meaningful changes:

- Register and sign in as a candidate; update a profile, save a job, upload a resume, and apply.
- Register and sign in as a recruiter; publish a job and review an application.
- Sign in as an admin; confirm admin screens and user controls work.
- Try opening private resume and message routes while signed out or as the wrong account; they should deny access.
- Check the browser console, server output, and mobile layout for errors or overflow.

## 10. Environment and deployment notes

`.env.example` lists the variables used by the app. Copy it to `.env.local` for local development and put real values only in your machine's local file or deployment secret manager. `.env*` files and `private_uploads/` are ignored by Git; keep them that way.

For S3-compatible storage, set `S3_BUCKET`, `S3_REGION`, and, when needed, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Give the storage credentials only the access they need. Never put secrets in browser code, commits, screenshots, or issue reports.

For deployment, configure `DATABASE_URL` and storage settings in the hosting provider, apply a reviewed database migration, build with `npm run build`, and start with `npm start`. Use a persistent PostgreSQL service and private durable file storage. Test account roles and private downloads on the deployed site before inviting real users.

## 11. Good habits while learning

- Read the nearby code before changing it; follow its existing style.
- Keep changes small enough to understand and test.
- Validate input on the server even if the form already validates it.
- Avoid putting secrets, personal data, or uploaded files into logs.
- Do not run schema or cleanup SQL on a real database until you understand each statement and have a backup.
- Explain what you changed in your own words in commit messages and project notes. Give people credit accurately; do not invent a personal story or claim someone wrote code if you do not know that they did.