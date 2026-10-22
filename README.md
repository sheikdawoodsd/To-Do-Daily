# TO DO Daily — Complete project with mobile fixes

This ZIP contains the full plain HTML/CSS/JavaScript project, the mobile UI updates, and Vercel serverless API files.

## Main files
- `index.html`, `verify.html`, `profile.html`, `todo.html`, `account.html`: pages
- `style.css`: shared styles and mobile responsiveness
- `auth.js`, `verify.js`, `profile.js`, `todo.js`, `account.js`: page behavior
- `config.js`: Google sign-in frontend setup
- `api/`: Vercel serverless routes for email OTP and Google sign-in
- `lib/sendVerificationCode.js`: email delivery helper

## Local preview
Because the project uses Vercel API routes for real email verification and Google sign-in, the server-backed features require deployment to Vercel and environment variables. A static Live Server preview can show the UI but cannot run Vercel API functions.

## Required Vercel environment variables for real email verification
`RESEND_API_KEY`, `EMAIL_FROM`, `OTP_HASH_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. For Google sign-in, set `GOOGLE_CLIENT_ID`. Set these in Vercel Project Settings → Environment Variables. Never put secret values in frontend files or commit them to GitHub.

The `/api/send-otp` and `/api/verify-otp` routes are compatibility aliases to the secure server-side handlers. The demo code display is only used if no JSON API route is available; successful real server mode does not expose the email code in the browser.
