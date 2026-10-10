# Web frontend

Next.js App Router with strict TypeScript, React, Tailwind CSS, and Lucide. Install and run from the repository root:

```bash
npm ci
npm run dev:web
npm test -w @sentinel/web
```

`app/` owns routes and loading/error/not-found boundaries. `features/` owns screen behavior; `components/` owns reusable panels and evidence UI. `lib/browser-state.ts` owns local theme and session review state.

Data and business rules come from `@sentinel/core`. The current screens deliberately use the challenge fixture; the initial API client is separate until live endpoints and mapping are agreed. See the [root README](../README.md).
