# Location-Puller

Location sharing app with a Vercel-ready deployment setup.

## Local development

1. Install dependencies:
	- `npm install`
2. Start the app:
	- `npm start`
3. Open `http://localhost:3000`

## Deploy on Vercel

This project is configured for Vercel with:

- Static pages served from `public/`
- A serverless API entry at `api/index.js`
- Route rewrites in `vercel.json`

### Persistent storage on Vercel

Serverless functions do not keep in-memory data between requests. For production, add an **Upstash Redis** integration in Vercel and set these environment variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without those variables, the app falls back to in-memory storage for local development only.

### Fixed link and mobile package links

Set these optional environment variables in Vercel:

- `FIXED_LINK_ID` (default: `live-location`)
- `ANDROID_APK_URL` (full URL to your Android `.apk` file)
- `IOS_IPA_URL` (full URL to your iOS `.ipa` file)

Alternative to env URLs:

- Place Android package at `public/downloads/app.apk`
- Place iOS package at `public/downloads/app.ipa`

If these files exist, the app will automatically expose them as download links even without env variables.

The landing page uses device detection:

- Android users see the APK link
- iPhone/iPad users see the IPA link
- Desktop users see a message to open the page on mobile

### Vercel routes

- `/` → landing page
- `/track/:linkId` → location share page
- `/dashboard/:linkId` → dashboard page
- `/api/*` → serverless API
