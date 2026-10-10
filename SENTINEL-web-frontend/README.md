# Web frontend

Next.js App Router with strict TypeScript, React, Tailwind CSS, and Lucide. Install and run from the repository root:

```bash
npm ci
npm run dev:web
npm test -w @sentinel/web
```

`app/` owns routes and loading/error/not-found boundaries. `features/` owns screen behavior; `components/` owns reusable panels and evidence UI. `lib/browser-state.ts` owns local theme and session review state.

Data and business rules come from `@sentinel/core`. The Review screen can load the live FastAPI queue using the typed client. Set `NEXT_PUBLIC_API_BASE_URL` in this directory's `.env.local` (for local development, `http://localhost:8000`) and restart `npm run dev:web` after changing it. The API must be running and allow requests from `http://localhost:3000`; the existing fixture-backed findings remain separate from the API queue. See the [root README](../README.md).
