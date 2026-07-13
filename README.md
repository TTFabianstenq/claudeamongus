# HOLLOWMOOR 🕯️

A first-person **survival horror** game that runs entirely in your browser.
Your car died on Braecken Lane; Hollowmoor House was the only light. The front
door was unlocked. The gate behind you was not chained an hour ago.

Escape the property. Something walks the house's rounds, and **it hears better
than it sees**.

> Hollowmoor is an original work. Every texture is painted onto canvases at
> runtime, every sound — footsteps, thunder, the score, _it_ — is synthesised
> with WebAudio on load, and the whole estate is generated from declarative
> level data. The repository ships **zero** binary assets and no third-party
> IP of any kind.

## Playing

- **Escape routes (3 endings):** cut the chain on the main gate · start the
  estate car and drive out · uncover what the family buried beneath the cellar.
- **Every night is different:** keys, tools, the safe's prize, its combination
  and the hatch code are reshuffled from a per-run seed. Verified solvable by
  construction.
- **The Keeper is not scripted.** A utility-driven state machine
  (dormant → patrol → listen → suspicious → investigate → search → track →
  chase → attack → return) over a real A\* navigation grid spanning three
  floors and the grounds. It never teleports.
  - **Hearing:** footsteps (surface- and stance-dependent), doors, drawers,
    thrown objects, breaking glass, machinery — all real positional noise
    events, attenuated by distance and floors. Thunder masks your sounds.
  - **Vision:** a facing cone with peripheral band, occlusion raycasts through
    real geometry (a closed door genuinely blocks its eyes), darkness/crouch
    concealment — and your flashlight gives you away.
  - **Memory & prediction:** last-known-position pursuit with velocity
    extrapolation, room-by-room searching, and **it checks hiding places —
    starting with the kind you use most** (learned habits persist in saves).
  - It opens doors, hammers locked ones, and splinters the breakable ones.
- **Systemic tools:** hide in wardrobes and under beds (hold your breath),
  lure it with the wireless or a hurled bottle, crawl through vents it cannot
  follow, cut power lights on to bait it across the house.
- **A storm that matters:** dynamic rain/wind cycles, lightning with
  distance-delayed thunder, guttering electricity when it walks near.

## Controls

| Input       | Action                                              |
| ----------- | --------------------------------------------------- |
| WASD        | Move                                                |
| Mouse       | Look                                                |
| Shift       | Sprint (stamina) / hold breath while hidden         |
| Ctrl or C   | Crouch — quieter, fits crawl vents, peek-opens doors |
| Space       | Jump / vault waist-high obstacles                   |
| Q / E       | Lean                                                |
| Left click  | Interact · throw held object                        |
| Right click | Grab / set down physics props                       |
| G           | Throw held object                                   |
| F           | Flashlight (batteries drain)                        |
| Tab         | Pockets & journal                                   |
| Esc         | Pause                                               |

Headphones strongly recommended.

## Tech

Next.js 15 (App Router) · React 19 · TypeScript (strict) · three.js ·
React Three Fiber · @react-three/drei · Rapier physics (@react-three/rapier) ·
@react-three/postprocessing (N8AO, bloom, grain, vignette, ACES) · custom GLSL
(storm sky, rain, dust motes, volumetric flashlight cone, mist, grass sway) ·
Zustand · Howler.js (3D positional audio) · Framer Motion · Leva (debug) ·
LocalStorage saves.

### Architecture

```
app/               Next.js shell (the game itself is fully client-side)
components/
  GameApp.tsx      Phase routing, pointer-lock management
  canvas/          The world: house, doors, furniture, windows, lights,
                   exterior, weather, particles, player, the Keeper, post FX
  ui/              Menus, HUD, inventory, notes, keypad/safe, saves, endings
game/
  levels/          Declarative estate data (single source of truth for
                   renderer, colliders and nav grid) + seeded randomiser
  ai/              Nav grid + A* (stairs as portal edges) and the Keeper brain
  audio/           OfflineAudioContext synthesiser, sound catalogue, engine
  graphics/        Procedural canvas textures, material cache, GLSL, batching
  state/           Zustand stores, per-frame runtime, save system
scripts/           Level connectivity validator (npm run validate:level)
```

Performance notes: the entire house renders as a handful of merged
geometry batches (one per material); rooms share a pooled set of point
lights; trees/grass/rain are instanced; quality presets (low → ultra) scale
resolution, shadows, SSAO, volumetrics and particle counts.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script                   | Purpose                              |
| ------------------------ | ------------------------------------ |
| `npm run build`          | Production build                     |
| `npm start`              | Serve the production build           |
| `npm run lint`           | ESLint                               |
| `npm run typecheck`      | Strict TypeScript                    |
| `npm run validate:level` | Assert the nav grid is fully connected |
| `npm run format`         | Prettier                             |

Append `?debug` to the URL for the Leva panel (Keeper state monitors,
weather overrides, cheats) and renderer stats.

## Deploying

The project is a static-page Next.js app with no server dependencies:

1. Push this repository to GitHub.
2. Import it on [Vercel](https://vercel.com/new) — no configuration needed.
3. Build command `npm run build`, output handled by Next automatically.

## License

[MIT](LICENSE). All code, art direction, writing and audio synthesis are
original to this repository.
