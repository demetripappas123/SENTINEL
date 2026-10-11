# Web frontend

Next.js App Router with strict TypeScript, React, Tailwind CSS, and Lucide. Install and run from the repository root:

```bash
npm ci
npm run dev:web
npm test -w @sentinel/web
```

Open `http://localhost:3000` to preview the dashboard. The web app requests
`/api/dataset` and `/api/queue` through Next.js; keep FastAPI running and point
`SENTINEL_API_URL` at it if it is not on the default `http://127.0.0.1:8000`.
The page shows loading, retry, and empty states as appropriate. Use the All
runs/V1/V2 control to compare analytics, then open a review item to see its
explanation and next step. The Assistant button shows a coming-soon dialog.

`app/` owns routes and loading/error/not-found boundaries. `features/` owns screen behavior; `components/` owns reusable panels and evidence UI. `lib/browser-state.ts` owns local theme and session review state.

Data and business rules come from `@sentinel/core`. The web dashboard combines
records from the FastAPI dataset and queue endpoints. See the [root README](../README.md).
