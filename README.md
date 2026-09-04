# NVL Studio — Desktop PNGtuber Studio

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat&logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-34+-47848F?style=flat&logo=electron&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat&logo=vite&logoColor=white)
![OBS Studio](https://img.shields.io/badge/OBS_Studio-Compatible-302E31?style=flat&logo=obsstudio&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-77_Passed-brightgreen?style=flat&logo=vitest&logoColor=white)

**An all-in-one desktop application for PNGtubers and streamers.**  
Create, animate, and broadcast responsive 2D avatars directly to OBS Studio in real-time.

[Overview](#overview) • [Key Features](#key-features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [OBS Integration](#obs-studio-integration) • [Roadmap](#roadmap)

</div>

---

## Overview

**NVL Studio** solves the fragmented workflow of PNGtuber streaming by uniting character management, natural animations, and live broadcasting into a single, high-performance desktop application. 

Instead of juggling separate drawing tools, animation software, and third-party browser utilities, NVL provides a local-first pipeline:
- **No cloud dependency or external servers** — runs 100% locally on your machine.
- **Embedded Broadcast Server** — broadcasts to OBS Studio Browser Source over ultra-low-latency WebSockets.
- **Deterministic 2D Canvas Engine** — renders crystal-clear transparent avatars at 60 FPS.
- **Dynamic Voice Detection (VAD)** — reactive mouth states powered by the Web Audio API with noise-floor auto-calibration.

---

## Key Features

### 🎨 1. Character Studio & Layer Persistence
- **Directory-Based Projects:** Each character project lives in a clean, self-contained directory (`<ProjectFolder>/project.nvl` + `assets/`).
- **Safe Persistence Workflow:** Native New Project, Open, Save, and Save As dialogs with automatic asset copying and relative forward-slash path normalization.
- **Dirty State Tracking:** Unsaved changes indicator with native window-close interception (Save / Don't Save / Cancel).
- **Graceful Fallback:** Missing assets render a non-crashing placeholder boundary with descriptive warnings. Corrupted project files are automatically preserved as `.nvl.bak`.

### 👁️ 2. Natural Animator & Audio VAD
- **Independent Blink Scheduling:** Natural blink cycles with randomized timing intervals (2.5s–5.5s) and quick-blink states (120ms).
- **Web Audio API VAD:** Low-latency voice activity detection with configurable volume thresholds, microphone boost, and release decay.
- **Noise Floor Auto-Calibration:** One-click room background noise profiling to set optimal speaking triggers instantly.
- **Interactive Talk Simulator:** Test speaking behaviors and avatar responses on-the-fly without speaking into a microphone.

### 📡 3. Live Broadcast Engine
- **Local OBS Browser Source:** Dedicated embedded HTTP & WebSocket server bound strictly to `127.0.0.1:17777`.
- **Zero-Flicker State Sync:** Sub-10ms state synchronization between the Studio desktop application and OBS.
- **Stale Frame Rejection & Auto-Reconnect:** Exponential backoff reconnection ensuring OBS never drops the avatar during app reloads or crashes.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                   NVL Desktop Studio                     │
│                                                         │
│  ┌───────────────────┐        ┌──────────────────────┐  │
│  │ Controls Panel    │        │ Top Menu Bar         │  │
│  │ • Mic VAD         │        │ • New / Open / Save  │  │
│  │ • Blink Scheduler │        │ • Dirty State Sync   │  │
│  │ • Talk Simulator  │        │ • Server Port Badge  │  │
│  └─────────┬─────────┘        └──────────┬───────────┘  │
│            ▼                             ▼              │
│  ┌───────────────────────────────────────────────────┐  │
│  │              ParameterStore (State)               │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│            ┌─────────────┴─────────────┐                │
│            ▼                           ▼                │
│  ┌───────────────────┐        ┌──────────────────────┐  │
│  │  Preview Canvas   │        │ LiveBroadcaster (WS) │  │
│  │  (Studio View)    │        └──────────┬───────────┘  │
│  └───────────────────┘                   │              │
└──────────────────────────────────────────┼──────────────┘
                                           │ ws://127.0.0.1:17777/ws/...
                                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Local Embedded Server                 │
│                 (127.0.0.1:17777, Node.js)              │
└──────────────────────────┬──────────────────────────────┘
                           │ http://127.0.0.1:17777/live/...
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  OBS Studio (Browser Source)            │
│                                                         │
│  ┌───────────────────┐        ┌──────────────────────┐  │
│  │ LiveReceiver (WS) │ ────▶  │ CanvasAvatarRenderer │  │
│  └───────────────────┘        │ (Transparent 60 FPS) │  │
│                               └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Security & Desktop Baseline
- **Electron Security:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- **Permission Scoping:** Only user-requested microphone audio is granted; arbitrary external navigation is completely blocked.
- **Native Dialogs:** All file pickers and alert prompts execute strictly in the Electron Main process.

---

## Getting Started

### Prerequisites
- **Node.js** 20.0.0 or higher
- **npm** 10.0.0 or higher
- **Windows 10/11** (Primary desktop target)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rexkarbu/nvl-studio.git
   cd nvl-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Vite dev server and launches the Electron desktop app |
| `npm test` | Executes the Vitest unit and integration test suite |
| `npm run typecheck` | Performs static TypeScript type checking with zero emit |
| `npm run lint` | Runs TypeScript lint validation |
| `npm run build` | Builds the production bundle (React frontend + Electron Main & Preload) |

---

## OBS Studio Integration

Connect your avatar to OBS Studio in 4 simple steps:

1. Launch **NVL Studio** (`npm run dev`).
2. In the **OBS Browser Source Broadcast** panel, copy the unique local source URL (e.g. `http://127.0.0.1:17777/live/default-avatar`).
3. In **OBS Studio**:
   - Add a new **Browser** Source (`+` &rarr; `Browser`).
   - Set **URL** to the copied address.
   - Set **Width** to `1920` and **Height** to `1080`.
   - Check **"Shutdown source when not visible"** (optional).
   - Clear any default Custom CSS (NVL provides transparent background natively).
4. Click **OK**. Your avatar is now live and will synchronize with your microphone instantly!

---

## Project Directory Structure

```text
nvl/
├── electron/                   # Electron Main process & Local Server
│   ├── main.ts                 # Main window lifecycle & IPC handlers
│   ├── preload.ts              # Secure contextBridge desktop API
│   └── server/                 # Embedded HTTP/WebSocket broadcast server
├── sample_avatar/              # Default template character
│   ├── project.nvl             # Manifest configuration (schemaVersion: 1)
│   └── assets/                 # PNG layers (body, eyes, mouth)
├── src/
│   ├── core/
│   │   ├── animation/          # BlinkScheduler timing engine
│   │   ├── audio/              # Web Audio VAD & TalkSimulator
│   │   ├── parameters/         # Reactive ParameterStore
│   │   ├── project/            # ProjectService, manifestSchema, pathResolver
│   │   ├── renderer/           # CanvasAvatarRenderer (HTML5 Canvas 2D)
│   │   ├── resolver/           # Deterministic layer visual resolver
│   │   └── sync/               # LiveBroadcaster & LiveReceiver (WebSocket)
│   ├── modules/
│   │   ├── live/               # Transparent LiveOutput application for OBS
│   │   └── workspace/          # Studio UI (TopMenuBar, Preview, Controls)
│   └── tests/                  # Automated Vitest test suite (46 tests)
└── vite.config.ts              # Vite & Electron build configuration
```

---

## Roadmap

- [x] **Stage A: Vertical Slice & OBS Live Broadcast (Steps 1–6)**
  - Local HTTP & WebSocket broadcast pipeline
  - Low-latency Canvas 2D renderer
  - Real-time VAD & Natural Blink loop
  - Automatic reconnection & snapshot synchronizer
- [x] **Stage B: Project Persistence & Layer System (Step 7)**
  - Native New/Open/Save/Save As file system dialogs
  - Manifest schema validation (`schemaVersion: 1`) & corrupted file `.bak` recovery
  - Dirty state tracking and window close protection
  - Missing asset fallback rendering
- [x] **Stage B: Character Creator Foundation (Step 8)**
  - Multi-select native PNG asset import with 8-byte magic-header validation & collision suffixing
  - Full-featured Layer Panel (reorder zIndex, inline rename, hide/show, delete)
  - Comprehensive Transform Inspector (position, aspect-locked scale, rotation slider, opacity)
  - Interactive Canvas Stage with direct selection, 8 scale handles + rotation stalk, mouse pan, zoom, and arrow nudges
  - Discord window occlusion background throttling mitigation (`backgroundThrottling: false`)
- [x] **Stage B: Semantic Roles & Rigging Rules (Step 9)**
  - Dropdown semantic role selector (`body`, `eye_open`, `eye_closed`, `mouth_closed`, `mouth_open`, `accessory`, `custom`)
  - Duplicate unique role prevention with confirmation reassign prompt
  - Color-coded role badges in LayerPanel
  - Non-blocking informative ValidationBanner for missing key roles
  - Quick-action "Auto-Assign Roles" regex pattern matcher
  - Live role binding checklist and indicators in ControlsPanel
- [ ] **Stage B: Animator Loop & Parameter Binding (Step 10)**
- [ ] **Stage C: Advanced Animator (Steps 11–14)**
  - Multi-frame frame-by-frame animation loops
  - Custom hotkey expressions (Happy, Sad, Angry, Surprised)
- [ ] **Stage D: Rigging & Mesh Deformers (Steps 15–20)**
  - 2D Mesh deformation & Physics bounce parameters

---

## License

This project is licensed under the [MIT License](LICENSE).
