# Sentinel — rules for every Devin session

**Sentinel is your network's advocate.** It watches the network, diagnoses outages with a LOCAL model
(it keeps working when the internet is down), fixes what it can, and when the internet provider is at
fault it **calls the provider's support line for you** with evidence and gets a ticket + credit.

Built during the Devin Hackathon (Sat 2026-10-24). Stack: Next.js 15 App Router, TypeScript, Tailwind v4,
Vitest. pnpm only.

## Contracts — do not change
- `src/lib/types.ts` — all shared types. Do not edit. Need a change? Say so in your PR description.
- `src/lib/mock.ts`, `src/lib/profile.ts` — fixtures; read, don't edit.
- `src/app/api/**` and `src/lib/sentinel.ts`, `src/lib/store.ts` — integrator-owned.

## Slice ownership (only touch your own folder + its tests)
| Slice | Owns |
|---|---|
| A · monitor + diagnose | `src/lib/monitor/**`, `src/lib/diagnose/**` |
| B · fix plugins | `src/lib/fixes/**` |
| C · provider call agent | `src/lib/call/**` |
| D · dashboard UI | `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**` |

## Done means
- `pnpm typecheck` and `pnpm test` pass; `pnpm build` passes for UI work.
- Unit tests next to the code (`*.test.ts`), no network calls in tests (inject/mocks).
- Small, readable modules. No new heavy dependencies without saying why in the PR.
- Open a PR to `main` titled `<slice>: <what it does>`. Don't ask questions unless blocked;
  pick the simplest reasonable option and note it in the PR.
