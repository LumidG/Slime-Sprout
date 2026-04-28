# AGENTS.md — Slime School Tycoon

Guidance for coding agents working in this repository.

## What this is

**Slime School Tycoon** is a browser-first idle / collection game: collect coins on a canvas playfield (flower-themed worlds), buy eggs, hatch slimes with layered sprites and traits, upgrade stats, breed parents in the **Breeding** tab, trade in an offline-simulated **Slime Market**, and fight in the **Arena** with ability cooldowns. The UI is a single mobile-style column (`max-w-md`) aimed at touch and Capacitor Android (`index.css` locks the shell to the viewport with internal scrolling and safe-area padding).

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 (`src/main.tsx` → `App`) |
| Build | Vite 6, TypeScript (`moduleResolution: bundler`, `noEmit`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` (`src/index.css` uses `@import "tailwindcss"`) |
| Animation | Motion (`motion/react`) |
| Icons | `lucide-react` |
| Native shell | Capacitor 8 — Android (`appId`: `com.nightskygames.slimeschooltycoon`, `webDir`: `dist`) |
| Capacitor APIs | `@capacitor/app` (foreground), `@capacitor/haptics` (optional tap feedback) |
| Custom native | `SystemUi` plugin — immersive status/navigation bars on Android (`src/systemUi.ts`, `android/.../SystemUiPlugin.java`) |

**Tooling:** `npm run align:sprites` runs `scripts/align-slime-sprite-anchors.mjs` (uses `sharp`) to recompute slime PNG anchor metadata under `public/` when art changes.

## Repository layout

| Path | Role |
| --- | --- |
| `src/App.tsx` | Main game state, persistence, tabs, overlays, settings, music/SFX wiring (large file) |
| `src/components/GameWorld.tsx` | Canvas playfield loop, coins, joystick, equipped slimes |
| `src/components/SlimeMarketPanel.tsx` | Slime Market auctions (player + NPC listings) |
| `src/components/SlimeArenaPanel.tsx` | Arena tab UI and flow into battle |
| `src/components/ArenaBattleCanvas.tsx` | Arena combat canvas |
| `src/components/SlimeStackSprite.tsx` | Layered body / eyes / accessory rendering |
| `src/hooks/useGameLoop.ts` | `requestAnimationFrame` loop with delta time |
| `src/hooks/useAppForeground.ts` | Document visibility + Capacitor app state (gates audio) |
| `src/hooks/useBlossomMusic.ts` | Background music |
| `src/hooks/useCoinCollectSfx.ts` | Coin collection sound |
| `src/hooks/useTapFeedback.ts` | Optional haptics on tap |
| `src/slimeSprites.ts` | Sprite index caps, breeding visuals, deterministic fallbacks from slime id |
| `src/systemUi.ts` | Capacitor bridge for immersive UI |
| `src/types.ts` | `GameState`, `Slime`, traits, arena abilities, market auctions, migrations |
| `src/constants.ts` | Balance numbers, trait effects, layout sizes |
| `capacitor.config.ts` | Capacitor app id, name, `webDir` |
| `android/` | Gradle project (includes `SystemUiPlugin` registration in `MainActivity`) |
| `scripts/prep-ai-studio-project.bat` | One-shot Windows script: Capacitor init + templates for greenfield setups |
| `scripts/align-slime-sprite-anchors.mjs` | Sprite anchor pass for slime PNGs |

Path alias: `@/*` → repository root (`vite.config.ts`, `tsconfig.json`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (`0.0.0.0`, port **3000**) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run sync:android` | `build` + `cap sync android` |
| `npm run android` | `build` + `cap sync android` + `cap run android` |
| `npm run align:sprites` | Regenerate slime sprite anchors (requires assets under `public/`) |

After changing web code, Android needs a web build and `cap sync` (or the scripts above).

## Architecture notes

- **State:** Almost all gameplay state lives in `App.tsx` (`useState` + `useCallback`). Canvas components receive props and do not own the long-term save model.
- **Persistence:** JSON in `localStorage` under key `slime_sprout_state`. Load applies capped offline idle coin gain, tab validation, and field migrations (e.g. legacy `market` / `slimeMarket` tab mapping, world order flags on `GameState`). Saving runs when `isLoading` is false.
- **Game loop:** `useGameLoop` drives canvas updates in `GameWorld` (and arena uses `ArenaBattleCanvas` separately).
- **Tabs / bottom nav:** `state.activeTab` is one of **`game`**, **`slimes`** (collection / eggs), **`market`** (breeding parents), **`slimeMarket`** (auctions), **`arena`**. Sub-state includes `activeSubTab` within **slimes**, upgrades panel, modals, onboarding.
- **Playfields:** `gameWorldIndex` / `maxUnlockedGameWorld` select among multiple themed worlds (see `types.ts` and `constants.ts`).
- **Audio & native:** Music and SFX respect `settings` and `useAppForeground`. Haptics use Capacitor when enabled.
- **Slime appearance:** Each slime stores `slimeBody`, `slimeEyes`, `slimeAccessory` indices; `slimeSprites.ts` centralizes caps, breeding mix rules, and id-based visual fallbacks for migrations.
- **Debug:** Bug icon in the header opens a debug overlay (add currency, reset, etc.). Treat as dev/test surface when changing balance or save format.

## Conventions for changes

- Prefer extending `types.ts` / `constants.ts` for new stats, arena abilities, or balance rather than scattering magic numbers.
- New UI should match existing patterns: Tailwind utilities, `motion` for transitions, `lucide-react` icons, compact mobile typography, safe-area helpers from `index.css`.
- If you change save shape, handle missing fields when loading from `localStorage` (follow existing migration patterns in `App.tsx`) so older saves keep working.
- Keep Capacitor identifiers (`capacitor.config.ts`, Android package / plugin registration) in sync if the app id changes.
- If you add or replace slime PNGs, run `npm run align:sprites` so stacked sprites stay aligned; commit updated outputs the script writes.

## Scaffolding script

`scripts/prep-ai-studio-project.bat` clears `README.md`, runs `cap init` / `cap add android`, and copies `package.json.template` and `vite.config.ts.template`. It is for **new** projects from a template; this repo already has a configured app. The script’s closing hint may mention “Agent.md”; the canonical agent instructions file here is **`AGENTS.md`** (this file).
