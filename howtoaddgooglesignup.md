# How to set up Google sign-up and sign-in

This guide explains how to configure Google sign-up and sign-in for CareerHub or for another deployment of this project. The application already includes the Google OAuth flow; setup consists of creating a Google OAuth client and providing its settings to the app.

## Before you start

You need:

- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/).
- A running CareerHub deployment and its public URL. For local development, the URL is usually `http://localhost:3000`.
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
4. Add the following **Authorized redirect URI** for a local app:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

5. For a deployed app, add its HTTPS callback as a separate authorized redirect URI. For example, if the public app URL is `https://careers.example.com`, use:

   ```text
   https://careers.example.com/api/auth/google/callback
   ```

   Replace the example host with the real public host. The scheme, host, port, and path must exactly match `GOOGLE_REDIRECT_URI` for that deployment. Production callbacks must use HTTPS.
6. Save/create the client.
7. Copy the **Client ID** and store it as `GOOGLE_CLIENT_ID`.
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

1. Open `http://localhost:3000`.
2. Choose **Create one** to open the registration form.
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

The Google Cloud authorized redirect URI and `GOOGLE_REDIRECT_URI` do not exactly match. Check `http` versus `https`, hostname, port, and the `/api/auth/google/callback` path. Save the Google setting, update the environment, and restart/redeploy.

### Google says the app is unavailable to this user

If the consent screen is in Testing, add the Google account under **Test users** in Google Auth Platform and try again.

### CareerHub says Google sign-in is not configured

Set all three `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` values in the server environment. Restart/redeploy the app after changing them. Ensure the secret is present only in a protected environment-variable store.

### Login says no account exists

Choose **Create one** and complete Google sign-up first. For recruiter registration, select the recruiter account type and enter the company name before continuing.

### Sign-in returns to CareerHub with an error

Check the server logs for a Google token exchange, profile lookup, or database error. Verify that the database is available and the OAuth client ID, secret, and callback URI all come from the same Google Cloud project/client.

## Security checklist

- Never commit a Google client secret or `.env.local`.
- Keep the client secret on the server; never use a `NEXT_PUBLIC_` variable for it.
- Use HTTPS for production callbacks.
- Limit OAuth consent scopes to those the app needs.
- Rotate/revoke a client secret immediately if it may have been exposed.
- Add only intended testers while the app is in Testing.
