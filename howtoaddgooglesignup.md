# How to set up Google sign-up and sign-in

This guide explains how to configure Google sign-up and sign-in for CareerHub or for another deployment of this project. The application already includes the Google OAuth flow; setup consists of creating a Google OAuth client and providing its settings to the app.

## Before you start

You need:

- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/).
- A running CareerHub deployment and its public URL. For local development, the URL is usually `http://localhost:3000`.
- If running in GitHub Codespaces, the browser-accessible forwarded URL for the running app (usually ending in `.app.github.dev`).
- A working PostgreSQL database configured with `DATABASE_URL`.
- A secure place to store environment variables. Do not put a client secret in source code, documentation, chat, screenshots, or a public repository.

Google OAuth apps in **Testing** publishing status only allow the test users listed on the OAuth consent screen. Add every person who needs to try sign-in as a test user.

## 1. Create or select a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or choose **New project**, enter a project name, and create it.
3. Confirm the new or selected project is active in the top project selector.

## 2. Configure the OAuth consent screen

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) for the selected project.
2. Open **Branding** (or the consent-screen configuration) and provide the required app name, support email, and developer contact email.
3. Select the audience that matches your app:
   - **Internal** is only available to eligible Google Workspace organizations and restricts sign-in to that organization.
   - **External** allows Google accounts outside your organization. Leave the app in **Testing** while developing.
4. On the **Data Access** page, request only these scopes:
   - `openid`
   - `email`
   - `profile`

   CareerHub uses these scopes to verify the user's Google identity and obtain their email and display name. It does not need access to Gmail, Drive, or other Google services.
5. If the app is in Testing, open **Audience** and add each tester's Google email address under **Test users**.
6. Save the consent-screen settings.

Google may change the console's labels or navigation over time; complete the equivalent branding, audience, and data-access settings if the screens differ.

## 3. Create a Web application OAuth client

1. In Google Auth Platform, open **Clients** and choose **Create client**. In older console layouts, use **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Choose **Web application** as the application type.
3. Give the client a recognizable name, such as `CareerHub local development`.
4. Add the callback URL under **Authorized redirect URIs**. For a local app:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

   For a Codespace, use the full HTTPS callback URL for the forwarded port, for example:

   ```text
   https://<your-codespace>-3000.app.github.dev/api/auth/google/callback
   ```

   For a deployed app, add its HTTPS callback as a separate authorized redirect URI. For example, if the public app URL is `https://careers.example.com`, use:

   ```text
   https://careers.example.com/api/auth/google/callback
   ```

   Replace the example host with the real public host. The scheme, host, port, and path must exactly match `GOOGLE_REDIRECT_URI` for that deployment. Production callbacks must use HTTPS.
5. Do not put a callback URL with a path in **Authorized JavaScript origins**. That field accepts only an origin, such as `https://<your-codespace>-3000.app.github.dev`, with no `/api/...` path and no trailing slash. A JavaScript origin is not a replacement for the full URL in **Authorized redirect URIs**; this server-side OAuth flow needs the latter.
6. Save/create the client.
7. Copy the **Client ID** and store it as `GOOGLE_CLIENT_ID`. Make sure this is the same Web application client where you registered the callback URI.
8. Copy the **Client secret** and immediately store it in a password manager or deployment secret store as `GOOGLE_CLIENT_SECRET`. Google may not show the secret again. If it is lost or exposed, create a new secret in Google Cloud, update the deployment, and revoke the old one.

The OAuth client ID is an identifier and is not a substitute for the secret. Never publish the client secret.

## 4. Set environment variables

For local development, copy `.env.example` to `.env.local` if you have not already done so. Set the Google values in `.env.local`:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Replace the example values with credentials from your own Google Cloud project. Do not add real secrets to `.env.example`, commit `.env.local`, or paste secrets into an issue or chat.

Keep the existing `DATABASE_URL` configured as well. Google authentication creates or looks up a CareerHub database account and then creates the application's normal database-backed session.

### Running inside GitHub Codespaces

If you open the app through a Codespaces forwarded port rather than `localhost:3000`, Google must redirect back to that same browser-accessible host:

1. Start the development server and open port `3000` in the **Ports** tab. Set the port visibility so the browser can reach the app. Google redirects the user's browser to the callback, so the app does not need to accept a direct server-to-server callback from Google.
2. Copy the forwarded HTTPS URL shown for port `3000`, for example `https://<your-codespace>-3000.app.github.dev`. Use the actual URL shown by Codespaces; it can change when the Codespace or forwarded port is recreated.
3. In Google Cloud, add this exact authorized redirect URI, replacing the example host:

   ```text
   https://<your-codespace>-3000.app.github.dev/api/auth/google/callback
   ```

4. Set `GOOGLE_REDIRECT_URI` in the Codespace's root `.env.local` to that same exact callback URL. Keep `GOOGLE_CLIENT_SECRET` in `.env.local` only; never put it in the tracked `.env.example`.
5. Restart `npm run dev` after changing `.env.local`, then open CareerHub using that same forwarded HTTPS URL.

The browser must use the same host registered as the OAuth redirect. Do not configure the callback as `localhost` if the browser is actually using a Codespaces URL. If the forwarded URL changes, update both Google Cloud's authorized redirect URI and `GOOGLE_REDIRECT_URI`, then restart the server.

For production:

1. Add the same three variables to your hosting provider's **server-side environment/secrets** settings. Do not use client-exposed names such as `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`.
2. Set `GOOGLE_REDIRECT_URI` to the exact HTTPS callback registered in Google Cloud.
3. Use the client ID and secret from the same Google OAuth client.
4. Redeploy/restart the app so the server loads the new variables.
5. Do not commit production credentials to GitHub.

## 5. Run the app and test sign-up

Start the project:

```sh
npm install
npm run dev
```

Then:

1. Open the app using the same host used in `GOOGLE_REDIRECT_URI` (for Codespaces, use the forwarded HTTPS URL).
2. Choose **Create one** to open the registration form. Google sign-in creates a new account only from this registration form; choosing **Sign in** will not create an account.
3. Choose **I'm looking** for a candidate account, or **I'm hiring** and enter a company name for a recruiter account.
4. Select **Continue with Google**.
5. Choose a Google account that is listed as a test user while the OAuth app is in Testing.
6. Approve the requested basic identity scopes.
7. Confirm that CareerHub opens and the new account is signed in.

Google sign-up uses the selected candidate/recruiter role. Recruiter registration requires a company name. The first Google sign-in during registration creates the account. Later sign-ins with that verified Google email use the existing CareerHub account and preserve its current role. Selecting **Sign in** does not create an account; a first-time user should choose **Create one**.

## 6. Test the deployed app and prepare launch

1. Add the production callback URI to the Web application OAuth client and set the matching HTTPS `GOOGLE_REDIRECT_URI` in production.
2. Test registration and sign-in from the production domain using a test account.
3. In Testing mode, confirm all intended testers have been added to the test-user list.
4. Before a public launch, review the consent-screen audience, branding, privacy policy, and any Google verification requirements for the chosen audience and scopes. Publish the app when ready; Google may require verification depending on the app, audience, and requested scopes.
5. Test an existing CareerHub account: signing in with the same verified Google email should use that account without changing its role.
6. Keep an administrator account provisioned through the app's admin setup procedure. Public Google registration only creates candidate or recruiter accounts.

## Troubleshooting

### `redirect_uri_mismatch`

The redirect URI in the Google authorization request must exactly match one of the **Authorized redirect URIs** on the Web application OAuth client identified by `GOOGLE_CLIENT_ID`. Compare the entire URI, including `http` versus `https`, hostname, port, and `/api/auth/google/callback` path. Do not add this full callback under **Authorized JavaScript origins**; that field rejects paths and is not used in place of the authorized redirect URI. Confirm the callback was saved on the same OAuth client as the configured client ID, update `GOOGLE_REDIRECT_URI` to match, then restart/redeploy. For an error-page URL containing `redirect_uri`, compare that value character-for-character with both settings.

### Google says the app is unavailable to this user

If the consent screen is in Testing, add the Google account under **Test users** in Google Auth Platform and try again.

### CareerHub says Google sign-in is not configured

Set all three `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` values in the server environment. Restart/redeploy the app after changing them. Ensure the secret is present only in a protected environment-variable store.

### Login says no account exists

This means the Google flow was started in **Sign in** mode, which does not create accounts. Return to the app, choose **Create one**, select the candidate or recruiter account type, and then select **Continue with Google**. Recruiter registration also requires a company name. If the Google callback returns a generic failure instead, check the development-server logs for a token exchange, profile, database, or session error.

### Sign-in returns to CareerHub with an error

Check the server logs for a Google token exchange, profile lookup, or database error. Verify that the database is available and the OAuth client ID, secret, and callback URI all come from the same Google Cloud project/client.

## Security checklist

- Never commit a Google client secret or `.env.local`.
- Keep the client secret on the server; never use a `NEXT_PUBLIC_` variable for it.
- Use HTTPS for production callbacks.
- Limit OAuth consent scopes to those the app needs.
- Rotate/revoke a client secret immediately if it may have been exposed.
- Add only intended testers while the app is in Testing.
