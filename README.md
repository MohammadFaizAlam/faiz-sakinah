<div align="center">

<br />

### سَكِينَة

# Sakinah — Qur'an Audio Sanctuary

*A calm, editorial Qur'an audio experience with real-time ayah & word-by-word synchronization, dynamic reciters, personal reflection bookmarks, and a voice-reactive WebGL liquid-silk backdrop.*

<br />

![React 19](https://img.shields.io/badge/React-19-0F1629?style=flat-square&logo=react&logoColor=8FA3C7&labelColor=0A0F1E)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-0F1629?style=flat-square&logo=typescript&logoColor=8FA3C7&labelColor=0A0F1E)
![Three.js WebGL](https://img.shields.io/badge/WebGL-GLSL%20Shader-0F1629?style=flat-square&logo=threedotjs&logoColor=8FA3C7&labelColor=0A0F1E)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind%20CSS-v4-0F1629?style=flat-square&logo=tailwindcss&logoColor=8FA3C7&labelColor=0A0F1E)
![Express](https://img.shields.io/badge/Express-Gzip%20Proxy-0F1629?style=flat-square&logo=express&logoColor=8FA3C7&labelColor=0A0F1E)
![Quran.com API v4](https://img.shields.io/badge/Data-Quran.com%20API%20v4-0F1629?style=flat-square&labelColor=0A0F1E)

</div>

---

## Philosophy

Sakinah (*tranquility*) is designed to feel like a quiet nocturnal sanctuary rather than a conventional media player. Every surface adheres to a restrained two-tone palette of **deep navy** and **silver blue**, pairing high-contrast editorial serif typography with authentic Uthmani script and organic, voice-driven light waves.

All recitations, verse texts, English translations, and millisecond-level timing segments are streamed live from the **Quran.com API v4** and **QuranicAudio CDN**—with zero simulated audio and zero hardcoded timestamps.

---

## Key Features

### Real-Time Ayah & Word-by-Word Sync
- **60fps `requestAnimationFrame` Engine**: Synchronizes active ayahs and individual Arabic words against `HTMLAudioElement.currentTime` using binary search over real API timestamp arrays (`timestamp_from` / `timestamp_to` and `segments`).
- **Calligraphic Word Glow & Tap-to-Inspect**: Each Arabic word illuminates softly as it is recited. Tapping any word opens a calm inspector displaying its Arabic text, transliteration, English gloss, isolated word pronunciation playback, and a quick jump to that exact moment in the recitation.
- **Adaptive Long-Ayah Layout**: Automatically adjusts typographic scale across four verse-length tiers (*short, medium, long, extended*) with top-safe auto-scrolling and a subtle **Resume** control whenever you scroll manually.
- **Seamless Reciter Switching**: Changing reciters preserves your position by **ayah** rather than seconds, resolving the exact matching verse timestamp for the newly selected voice.

### Voice-Reactive WebGL Silk Backdrop
- **Custom Three.js GLSL Fragment Shader**: Full-viewport layered liquid-silk ribbons rendered once on a persistent canvas and driven by real-time Web Audio `AnalyserNode` vocal energy (`uVoiceLevel`, `uVoiceWarmth`, `uVoiceCrest`).
- **Atmosphere Tuning Popover**: Choose between three curated shader moods—**Midnight Silk**, **Lunar Mist**, and **Still Night**—adjust vocal reactivity from *Still* to *Expressive* with a live 5-band silver-blue meter, or toggle word-by-word illumination.
- **Graceful Performance**: Automatically adapts to software-WebGL environments and `prefers-reduced-motion` without blocking UI interaction.

### Fast Surah Explorer & Progressive Loading
- **114-Surah Animated Modal & Mobile Sheet**: Includes fuzzy search (English transliteration, meaning, Arabic name, or surah number), revelation/bookmark filters (**All**, **Makkan**, **Madinan**, **Saved**), and an **Often recited** quick-jump strip.
- **Two-Stage Progressive Fetching**: Chapters load audio, timings, and Uthmani/English verse text in a single gzip-compressed hop so even 286-verse *Al-Baqarah* renders and plays almost instantaneously, while word-by-word metadata hydrates asynchronously in the background.
- **Instant Skipping & Prefetching**: Leading-edge surah switching with `AbortController` cancellation for rapid skips, plus a 32-entry client LRU cache and idle prefetching of neighboring surahs (`n-1`, `n+1`, `n+2`).

### Personal Reflection Bookmarks & Listening Journey
- **Ayah Reflections**: Bookmark any verse with a personal reflection note (`B` shortcut or bookmark icon on the active ayah) and return directly to that exact verse at any time.
- **Listening Journey**: Tracks listening time, daily streak, recently visited surahs, and saved reflections locally in `localStorage` (`sakinah:journey:v1`)—accessible in the full-height desktop sidebar or the mobile Journey sheet.

---

## Design System

| Token | Value | Role |
| :--- | :--- | :--- |
| **Base Navy** | `#0A0F1E` | Primary canvas & deep sanctuary ground |
| **Elevated Navy** | `#0F1629` – `#151D33` | Glass panels, cards, modals, and player dock |
| **Silver Blue** | `#8FA3C7` | Primary accent, active glows, progress fill, icons, hairline borders (`8%–14%`) |
| **Warm Cream** | `#ECE9E1` | Primary Arabic script, headings, and active translations |
| **Muted Silver** | `rgba(143, 163, 199, 0.55–0.70)` | Secondary metadata, timestamps, and inactive verses |

**Typography**
- **Display & Translations**: `Cormorant Garamond` (regular & italic)
- **Qur'anic Arabic Script**: `Amiri Quran` (Uthmani rendering with generous vertical line-height)
- **Interface & Tabular Numerals**: `DM Sans`

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + TypeScript + Tailwind CSS v4 + Framer Motion)       │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │  SilkWebGLBackground│  │  AudioEngine (rAF)  │  │  Zustand Stores  │  │
│  │  Three.js GLSL      │◄─┤  Web Audio Analyser │◄─┤  playerStore     │  │
│  │  (3 moods + voice)  │  │  Binary-search sync │  │  journeyStore    │  │
│  └─────────────────────┘  └──────────┬──────────┘  └────────┬─────────┘  │
│                                      │                      │            │
│                              32-Entry LRU Cache (surahCache)│            │
└──────────────────────────────────────┼──────────────────────┼────────────┘
                                       │ Gzipped JSON (/api/*)
┌──────────────────────────────────────▼───────────────────────────────────┐
│  Express Server (server.ts — Port 3000 + Vite Dev Middleware / Dist)     │
│  • Native node:zlib gzip compression    • In-memory TTL caching (1–24h)  │
│  • Two-stage fast chapter + background word-by-word hydration            │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
            Quran.com API v4 & QuranicAudio CDN (CORS-enabled)
```

### API Proxy Endpoints

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/chapters` | All 114 surahs with Arabic names, transliterations, translations, revelation place, and verse counts |
| `GET` | `/api/reciters` | Dynamic list of available chapter reciters with recitation styles |
| `GET` | `/api/surah/:chapterId?reciterId=...` | Fast chapter payload: Uthmani verses, English translation, audio URL, per-ayah timestamps, and word segments |
| `GET` | `/api/words/:chapterId` | Paginated word-by-word metadata (transliteration, English gloss, isolated word audio URLs) for non-blocking hydration |
| `GET` | `/api/audio/:chapterId?reciterId=...` | Lightweight audio & timing refresh when switching reciters on the current surah |

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause recitation |
| `←` / `→` | Seek backward / forward 5 seconds |
| `↑` / `↓` | Jump to previous / next ayah |
| `/` | Open Surah explorer modal |
| `B` | Add or edit a reflection bookmark on the active ayah |
| `M` | Toggle mute |
| `Esc` | Close active modal, drawer, or popover |

---

## Project Structure

```text
.
├── server.ts                          # Express server, gzip proxy, TTL caches & Quran.com v4 integration
├── index.html                         # Entry HTML, Google Fonts & metadata
├── src/
│   ├── App.tsx                        # Full-viewport sanctuary layout shell
│   ├── index.css                      # Tailwind v4 theme tokens, typography & calm scrollbars
│   ├── components/
│   │   ├── SilkWebGLBackground.tsx    # Persistent Three.js custom GLSL shader backdrop
│   │   ├── AudioEngine.tsx            # Headless rAF sync, Web Audio AnalyserNode & prefetch loop
│   │   ├── AyahTheater.tsx            # Centered synced ayah view with adaptive long-ayah sizing
│   │   ├── WordInspectorPopover.tsx   # Tap-to-inspect word gloss, transliteration & audio
│   │   ├── PlayerDock.tsx             # Inset progress scrubber, transport controls & volume
│   │   ├── TopBar.tsx                 # Minimal header, Atmosphere trigger & mobile controls
│   │   ├── DesktopSidebar.tsx         # Full-height desktop panel (Reciters / Saved / Journey)
│   │   ├── SurahDrawer.tsx            # Animated 114-surah fuzzy search modal & mobile sheet
│   │   ├── AtmospherePopover.tsx      # Shader mood swatches, reactivity slider & live meter
│   │   ├── ReflectionModal.tsx        # Personal reflection note editor
│   │   ├── JourneyPanelContent.tsx    # Shared Saved & Listening Journey views
│   │   └── JourneyDrawer.tsx          # Mobile/tablet Journey bottom sheet
│   ├── store/
│   │   ├── playerStore.ts             # Playback, active ayah/word, reciter & abortable fetch state
│   │   └── journeyStore.ts            # Persisted bookmarks, streak, sessions & visualizer tuning
│   ├── lib/
│   │   ├── quranUtils.ts              # Binary search sync, fuzzy search, HTML sanitizer & tiering
│   │   ├── journeyUtils.ts            # Streak, bookmark upsert & session formatting helpers
│   │   ├── surahCache.ts              # 32-entry LRU cache & background word-hydration merger
│   │   ├── shaderSignal.ts            # Zero-re-render 60fps Web Audio -> WebGL signal bridge
│   │   ├── audioBridge.ts             # Imperative audio control bridge
│   │   └── *.test.ts                  # Deterministic unit tests (node:test)
│   └── types/
│       └── quran.ts                   # Strict TypeScript contracts for chapters, verses & timings
└── package.json
```

---

## Getting Started

### Prerequisites
- **Node.js** `20+` (or `22+`)
- **npm** (or **bun**)

### Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack dev server (Express API + Vite on http://localhost:3000)
npm run dev
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Express + Vite middleware on port `3000` |
| `npm run build` | Builds the production client bundle into `dist/` |
| `npm run start` | Serves the production build via Express on port `3000` |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`) |

### Running Unit Tests

Core pure logic (binary-search ayah/word timing, fuzzy surah matching, long-ayah tiering, streak/bookmark reducers, and LRU cache word merging) is covered with Node's native test runner:

```bash
npx --yes tsx --test src/lib/quranUtils.test.ts src/lib/journeyUtils.test.ts src/lib/surahCache.test.ts
```

---

## Attribution

- **Qur'an Text, Word-by-Word Data & Timings**: [Quran.com API v4](https://api-docs.quran.com/)
- **English Translation**: M.A.S. Abdel Haleem (resolved dynamically via Quran.com translation resources)
- **Recitation Audio**: [QuranicAudio](https://quranicaudio.com/) & QuranCDN
