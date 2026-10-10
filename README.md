# SENTINEL

Inspection reliability and operator triage for the NextEra SPOT challenge.

## Frontends

| Workspace | Stack | Purpose |
|---|---|---|
| `SENTINEL-web-frontend` | Next.js 16, React, TypeScript, Tailwind 4 | Overview, missions, review, facility, recorded replay |
| `SENTINEL-mobile-frontend` | Expo SDK 57, React Native, TypeScript | Native attention queue, mission evidence, facility context |
| `packages/core` | TypeScript | Shared records, fixtures, metrics, triage selectors, API contracts, colors |

Use Node.js 24 or newer. Install from the repository root; the root lockfile is the source of truth.

```bash
npm ci
npm run dev:web
# In another terminal:
npm run dev:mobile
```

The web app runs at http://localhost:3000. Expo displays connection instructions for a compatible device or simulator.

## TDD and checks

```bash
npm test
npm run typecheck
npm run lint
npm run build:web
npm run check:deps -w @sentinel/mobile
npm run build:mobile
```

Write a failing behavior test, observe its failure, implement the smallest change, then refactor with the suite green. Web and shared logic use Vitest; native screens use Jest Expo and React Native Testing Library. Native render and event APIs are asynchronous. CI runs the same checks, including both native bundle targets.

The setup plan lives in [docs/superpowers/plans](docs/superpowers/plans/2026-10-10-frontend-foundation.md). The [HTML design studies](design/mockups/README.md) remain available for visual iteration.

## Data and API boundary

Both apps currently use the supplied synthetic challenge data. Regenerate fixtures and illustrative assets with `npm run data:import`. Mission completion and action success are calculated separately. The recorded replay contains 500 events and stops during M023.

Review acknowledgment is local: a browser session for web, the running app session for mobile. It does not update FastAPI or a database. Images are kit illustrations rather than evidence associated with individual records; waypoint pins are illustrative rather than coordinates.

`packages/core/src/api/client.ts` provides a typed, response-validated client for the existing FastAPI `GET /health` and `GET /queue`. Instantiate it with the backend base URL when wiring live data. API queue verdicts differ from raw challenge findings; that integration needs an explicit mapping. No backend persistence, authentication, or robot controls are added here.

## Next iterations

- Connect a data repository to FastAPI once mission and evidence endpoints exist.
- Persist review acknowledgments after their backend contract is agreed.
- Validate layouts in an approved browser and on iOS/Android devices.
- Add end-to-end coverage once live data and authentication are introduced.

Testing setup follows the [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) and [Expo testing guide](https://docs.expo.dev/develop/unit-testing/).
