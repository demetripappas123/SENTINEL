# Mobile frontend

Expo SDK 57, React Native, strict TypeScript, and native components. Install from the repository root, then run:

```bash
npm run dev:mobile
npm test -w @sentinel/mobile
npm run typecheck -w @sentinel/mobile
npm run check:deps -w @sentinel/mobile
npm run build:mobile
```

`App.tsx` owns navigation and session state. `src/screens.tsx` owns attention, mission history, and facility context; `src/evidence-sheet.tsx` owns finding and action inspection. Shared records, triage logic, and colors come from `@sentinel/core`.

Review acknowledgments last for the running app session. No backend is required. Bundle checks verify iOS and Android compilation; they do not replace simulator or device testing.

This directory was originally an empty Git link without submodule metadata. The foundation converts it into a normal tracked workspace; the original reference is recorded in the setup plan.
