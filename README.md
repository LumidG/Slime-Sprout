# Slime School Tycoon

A small idle-style game built with React and Vite. You collect coins on a canvas playfield, spend them on eggs, hatch slimes with traits, upgrade them, and breed new ones. Progress is saved in the browser (`localStorage`). The interface is laid out like a phone app and can be packaged for **Android** with [Capacitor](https://capacitorjs.com/).

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- For running on a device or emulator: **Android Studio** and SDK setup (see [Capacitor Android docs](https://capacitorjs.com/docs/android))

## Getting started

```bash
npm install
npm run dev
```

The dev server listens on **port 3000** and binds to all interfaces (`0.0.0.0`), so you can open it from another machine on the network if needed.

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite in development mode |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run sync:android` | Build web assets and sync into `android/` |
| `npm run android` | Build, sync, and run the Android app |

After you change the web app, run a build and sync (or `npm run android`) so the native project picks up `dist/`.

## Tech stack

- **React** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling
- **Motion** for animations, **Lucide** for icons
- **Capacitor** for the Android shell (`appId`: `com.nightskygames.slimesprout`)

## Project layout

| Path | Role |
| --- | --- |
| `src/App.tsx` | Game state, tabs, saves, overlays |
| `src/components/GameWorld.tsx` | Canvas gameplay and loop integration |
| `src/hooks/useGameLoop.ts` | Animation frame loop helper |
| `src/types.ts` / `src/constants.ts` | Types and balance constants |
| `capacitor.config.ts` | App name, id, web output directory |
| `android/` | Gradle Android project (generated / synced by Capacitor) |

TypeScript path alias: `@/` maps to the repository root.

## Scaffolding script

`scripts/prep-ai-studio-project.bat` is a Windows helper used to bootstrap a **new** Capacitor + Vite project from templates. This repository is already configured; you normally do not need to run it here.

## Contributing / automation

For conventions, architecture notes, and agent-oriented context, see **[AGENTS.md](./AGENTS.md)**.
