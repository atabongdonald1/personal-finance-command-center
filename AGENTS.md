# Project Guidance

## User Preferences

- The app is a personal financial planning and execution system, not just an expense tracker
- It should help control money today, plan expected income, allocate money intelligently, reduce debt, build savings, finance projects, grow businesses and work toward long-term financial independence
- Personal financial planning and execution system with private per-user records
- Responsive layout usable on desktop, tablet and mobile

## Accepted Requirements

[Filled after each deployed build — what the user asked for and the build delivered]

## Verified Commands

- **typecheck**: `pnpm typecheck (from src/frontend/)`
- **fix**: `mops check --fix (from src/backend/) and pnpm fix (from src/frontend/)`
- **build**: `mops build (from src/backend/) and pnpm build (from src/frontend/)`

## Learnings

- Backend commands from src/backend/: mops install, mops check --fix, mops build. Frontend commands from src/frontend/: pnpm install --prefer-offline, pnpm typecheck, pnpm fix. Bindings from the project root: pnpm bindgen.
- Enhanced Migration is configured in mops.toml ([canisters.backend.migrations], chain src/backend/migrations); load skill(migrating-motoko-actors) before changing any stored record.
- src/backend/main.mo is the composition root: type-only stable fields for every Ledgerly collection keyed by owner Principal, per-owner id counters, MixinAuthorization(accessControlState, null), Expose with 9 OQL entities, and the getApiDoc include from src/backend/mixins/api-doc.mo.
- src/frontend/src/backend.ts and src/frontend/src/backend.d.ts are generated bindgen wrappers; never edit them by hand.
- src/frontend/src/hooks/useQueries.ts is the shared TanStack Query layer. Entry mutations must invalidate the whole ["report"] key prefix, because the dashboard and the Reports page both read useReport with queryKey ["report", period, from, to].
- listDebts returns remaining equal to debt.balance (the balance is already reduced at payment time); per-debt paid amounts must be derived from the payments list, never from original minus remaining.
- The tester owns src/frontend/src/__tests__/*.test.tsx and test/pocketic/backend.test.ts; production workers must leave them alone even when a change makes them fail to compile.
