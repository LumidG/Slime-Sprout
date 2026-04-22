# AGENTS.md — Slime School Tycoon

Guidance for coding agents working in this repository.

## What this is

**Slime School Tycoon** is a browser-first idle / collection game: tap coins in a canvas playfield, buy eggs, hatch slimes with traits, upgrade stats, and breed slimes. The UI is a single mobile-style column (`max-w-md`) aimed at touch and Capacitor Android.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 (`src/main.tsx` → `App`) |
| Build | Vite 6, TypeScript (`moduleResolution: bundler`, `noEmit`) |
| Styling | Tailwind CSS v4 (`src/index.css` uses `@import "tailwindcss"`) |
| Animation | Motion (`motion/react`) |
| Icons | `lucide-react` |
| Native shell | Capacitor 8 — Android (`appId`: `com.nightskygames.slimesprout`, web assets: `dist`) |

**Note:** `package-lock.json` lists dependencies such as `motion`, `lucide-react`, and `tailwindcss` that may not all appear in `package.json`. If installs fail or versions drift, align `package.json` with the lockfile or run a fresh `npm install` after fixing manifests.

## Repository layout

| Path | Role |
| --- | --- |
| `src/App.tsx` | Main game state, persistence, tabs, overlays (large file) |
| `src/components/GameWorld.tsx` | Canvas game loop, coins, joystick, equipped-slime helpers |
| `src/hooks/useGameLoop.ts` | `requestAnimationFrame` loop with delta time |
| `src/types.ts` | `GameState`, `Slime`, traits, etc. |
| `src/constants.ts` | Balance numbers, trait effects, layout sizes |
| `capacitor.config.ts` | Capacitor app id, name, `webDir: 'dist'` |
| `android/` | Gradle Android project (synced from web build) |
| `scripts/prep-ai-studio-project.bat` | One-shot Windows script: Capacitor init + templates for greenfield setups |

Path alias: `@/*` → repo root (`vite.config.ts`, `tsconfig.json`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (configured host `0.0.0.0`, port **3000**) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run sync:android` | `build` + `cap sync android` |
| `npm run android` | `build` + `cap sync android` + `cap run android` |

After changing web code, Android needs a web build and `cap sync` (or use the scripts above).

## Architecture notes

- **State:** Almost all gameplay state lives in `App.tsx` (`useState` + `useCallback`). `GameWorld` receives props (`onCollect`, upgrade levels, equipped slimes) and does not own the long-term save model.
- **Persistence:** JSON in `localStorage` under key `slime_sprout_state`. Load path applies capped offline idle coin gain (see `App.tsx`). Saving runs when `isLoading` is false.
- **Game loop:** `useGameLoop` drives canvas updates in `GameWorld` (movement, coins, effects).
- **Tabs:** `state.activeTab` switches among **game**, **slimes** (eggs / collection), **market** (breeding). Sub-state includes upgrades panel, modals, onboarding.
- **Debug:** Bug icon in the header opens a debug overlay (add currency, reset, etc.). Treat as dev/test surface when changing balance or save format.

## Conventions for changes

- Prefer extending `types.ts` / `constants.ts` for new stats or balance rather than scattering magic numbers.
- New UI should match existing patterns: Tailwind utility classes, `motion` for transitions, `lucide-react` icons, compact mobile typography.
- If you change save shape, handle missing fields when loading from `localStorage` (or bump migration logic) so existing saves do not soft-break.
- Keep Capacitor identifiers (`capacitor.config.ts`, Android package) in sync if the app id changes.

## Scaffolding script

`scripts/prep-ai-studio-project.bat` clears `README.md`, runs `cap init` / `cap add android`, and copies `package.json.template` and `vite.config.ts.template`. It is for **new** projects from a template; this repo already has a configured app. The script’s closing hint mentions “Agent.md”; the canonical agent instructions file here is **`AGENTS.md`** (this file).
