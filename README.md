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

### Vercel routes

- `/` → landing page
- `/track/:linkId` → location share page
- `/dashboard/:linkId` → dashboard page
- `/api/*` → serverless API
