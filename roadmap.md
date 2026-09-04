# NVL — Updated Step-by-Step Implementation Roadmap

## Product Direction

NVL dikembangkan secara bertahap dari:

**PNGtuber Desktop App**

menjadi:

**2D Avatar Creation + Animation + Rigging + Live Streaming Studio**

Namun implementasi tidak boleh mencoba membangun seluruh sistem tersebut sekaligus.

Prioritas pertama tetap:

NVL Desktop
→ Sample Avatar
→ Talk / Blink / Microphone
→ Parameter System
→ Local WebSocket
→ Transparent Browser Source
→ OBS

Setelah pipeline PNGtuber MVP stabil, NVL baru dikembangkan menuju:

Character Creator
→ Animator
→ Parameter Animation
→ Mesh Rigging
→ Deformation
→ Physics
→ Face Tracking
→ Advanced Live Output

# ROADMAP OVERVIEW

## STAGE A — CORE PNGTUBER FOUNDATION

Step 1 — Desktop Foundation
Step 2 — Character Core Architecture
Step 3 — Audio / Blink Input System
Step 4 — Real-Time Sync Protocol
Step 5 — Live Output Renderer
Step 6 — OBS Vertical Slice

## STAGE B — PNGTUBER CREATOR MVP

Step 7 — Project Persistence
Step 8 — Character Creator
Step 9 — Semantic Layer Assignment
Step 10 — Animator Configuration
Step 11 — MVP Hardening & Windows Release

===============================

**NVL PNGTUBER MVP COMPLETE**

===============================

## STAGE C — ADVANCED PNGTUBER

Step 12 — Expressions & Hotkeys
Step 13 — Multi-Frame Mouth & Parameter Mapping
Step 14 — Simple Keyframe Animation

## STAGE D — 2D RIGGING FOUNDATION

Step 15 — GPU Renderer & Rigging Architecture
Step 16 — Mesh Foundation
Step 17 — Mesh Editor
Step 18 — Parameter Rigging System
Step 19 — Mesh Deformation & Interpolation
Step 20 — Deformer / Node Hierarchy

## STAGE E — ADVANCED AVATAR SYSTEM

Step 21 — Physics System
Step 22 — Face Tracking
Step 23 — Advanced Rigging Tools

## STAGE F — ADVANCED OUTPUT

Step 24 — Virtual Camera & Additional Output Targets

# STEP 1 — Initialize Desktop Project & Core Dependencies

## Goal

Membangun fondasi NVL sebagai desktop application.

Gunakan:

- Electron
- React 19
- TypeScript
- Vite
- Node.js
- ws
- Vitest

Gunakan current stable mutually-compatible dependencies pada saat implementasi.

Lock exact resolved versions melalui lockfile.

Jangan menggunakan Express jika Node.js native HTTP server sudah cukup untuk kebutuhan local live-output server.

## Desktop Architecture

Setup:

- Electron Main Process
- Electron Renderer
- Preload Script
- React Application
- Local HTTP Server
- Local WebSocket Server
- TypeScript
- Vite
- Vitest
- lint
- typecheck
- build scripts

## Electron Security Baseline

Wajib:

```text
contextIsolation: true
sandbox: true
nodeIntegration: false
```

Renderer tidak boleh memiliki direct access ke:

- Node.js
- filesystem
- shell
- child_process
- arbitrary IPC

Gunakan `contextBridge` untuk API minimum NVL.

## Local Server

Bind secara eksplisit ke:

```text
127.0.0.1
```

Preferred port awal:

```text
17777
```

Jika port bentrok:

```text
17777
→ 17778
→ 17779
→ ...
```

Actual resolved port adalah runtime state.

## PASS Criteria

STEP 1 PASS jika:

- Electron boot
- React renderer berjalan
- preload bridge berjalan
- local HTTP server berjalan
- WebSocket server berjalan
- port fallback bekerja
- graceful shutdown bekerja
- sockets dibersihkan saat exit
- typecheck PASS
- lint PASS
- test PASS
- build PASS

# STEP 2 — Core Parameter System, Character Model, Resolver & Renderer

## Goal

Membangun core avatar yang tidak bergantung langsung pada PNGtuber behaviour tertentu.

Pipeline:

```text
Input
↓
Parameter Store
↓
Character / Rig Resolver
↓
Renderer
```

# Parameter System

Buat:

```text
core/parameters/
```

Parameter minimum MVP:

```ts
interface AvatarParameters {
  voiceActivity: boolean;
  voiceLevel: number;
  blink: boolean;
}
```

Parameter system harus dapat diperluas nanti menjadi:

```ts
interface AvatarParameters {
  voiceActivity: boolean;
  voiceLevel: number;
  blink: boolean;

  mouthOpen?: number;
  mouthShape?: string;

  expression?: string;

  headX?: number;
  headY?: number;
  headRotation?: number;

  eyeOpenLeft?: number;
  eyeOpenRight?: number;

  bodyX?: number;
  bodyY?: number;

  custom?: Record<string, number | boolean | string>;
}
```

Jangan implementasikan semua parameter future sekarang.

Struktur hanya harus memungkinkan penambahan tersebut tanpa redesign besar.

# Character Model

Jangan membuat CharacterModel terlalu spesifik seperti:

```ts
interface CharacterModel {
  mouthOpenImage: string;
  mouthClosedImage: string;
}
```

Gunakan model generik:

```ts
interface CharacterModel {
  id: string;
  layers: CharacterLayer[];
}
```

Untuk MVP:

```ts
interface CharacterLayer {
  id: string;
  name: string;

  type: "sprite";

  assetId: string;

  role?: LayerRole;

  transform: LayerTransform;

  visible: boolean;
  opacity: number;
  zIndex: number;
}
```

Field `type` harus dipertahankan sejak awal.

MVP hanya mengimplementasikan:

```text
sprite
```

Tetapi di masa depan model dapat berkembang menjadi:

```text
sprite
mesh
```

tanpa mengganti keseluruhan CharacterModel.

# Character Resolver

Resolver menerima:

```text
CharacterModel
+
AvatarParameters
```

dan menghasilkan:

```text
ResolvedVisualState
```

Role minimum MVP:

- body
- eye_open
- eye_closed
- mouth_open
- mouth_closed
- accessory
- custom

## Rules

```text
blink = false
→ eye_open

blink = true
→ eye_closed

voiceActivity = false
→ mouth_closed

voiceActivity = true
→ mouth_open
```

Talking dan Blink harus independen.

Contoh:

```text
voiceActivity = true
blink = true
```

menghasilkan:

```text
mouth_open
+
eye_closed
```

# Renderer

Gunakan Canvas 2D untuk MVP.

Renderer mendukung:

- zIndex
- position
- scale
- rotation
- opacity
- visibility

Jangan memasukkan mesh rendering sekarang.

Pastikan renderer berada di belakang abstraction agar nantinya dapat diganti atau diperluas menjadi GPU renderer.

# Built-in Sample Avatar

Sediakan:

- Body
- Eye Open
- Eye Closed
- Mouth Open
- Mouth Closed

## PASS Criteria

STEP 2 PASS jika:

- sample avatar tampil
- layer order benar
- transforms bekerja
- Talk simulation bekerja
- Blink simulation bekerja
- Talking + Blink bekerja
- CharacterModel tidak hard-coded terhadap jumlah eye/mouth image tertentu
- resolver tests PASS

# STEP 3 — Audio VAD, Talk Simulator & Blink Scheduler

## Talk Simulator

```text
Hold Talk
→ voiceActivity = true

Release
→ voiceActivity = false
```

Input hanya boleh mengubah Parameter Store.

# Blink Scheduler

Automatic semi-random blink.

Default awal:

```text
Interval:
3–6 detik

Duration:
~150 ms
```

Scheduler mengubah:

```text
parameters.blink
```

# Microphone / VAD

Pipeline:

```text
Microphone
↓
Audio Analyzer
↓
RMS
↓
Voice Activity Detection
↓
Parameter Store
```

Output:

```text
voiceLevel
voiceActivity
```

Configuration:

- microphone device
- threshold
- sensitivity
- release delay

Tambahkan Audio Meter.

## PASS Criteria

- Talk Simulator bekerja
- Blink otomatis bekerja
- microphone terbaca
- voiceLevel berubah real-time
- VAD bekerja
- release delay bekerja
- Talk + Blink bersamaan bekerja

# STEP 4 — Real-Time Sync Protocol & Local WebSocket

## Goal

Memisahkan runtime avatar dari desktop editor.

Protocol:

```ts
interface LiveFrameMessage {
  version: number;
  type: "parameters";

  projectId: string;

  sequence: number;
  timestamp: number;

  parameters: AvatarParameters;
}
```

Protocol harus berbasis parameter.

Jangan membuat protocol berdasarkan hard-coded animation state seperti:

```text
idle
talking
blink
```

Parameter protocol penting untuk future rigging.

# Endpoint

```text
ws://127.0.0.1:<port>/ws/<project-id>
```

Live output:

```text
http://127.0.0.1:<port>/live/<project-id>
```

# Server State

Server menyimpan:

```text
latest LiveFrameMessage
```

per project.

# Reconnect

Ketika client connect:

```text
Connect
↓
Join Project Room
↓
Receive Latest Snapshot
↓
Render
```

# Stale Frame Protection

Jika:

```text
incoming.sequence <= latestSequence
```

maka:

```text
ignore
```

## PASS Criteria

- WebSocket communication bekerja
- latest snapshot bekerja
- reconnect bekerja
- stale frame protection bekerja
- protocol validation bekerja

# STEP 5 — Live Output Page

Route:

```text
/live/:projectId
```

Live Output harus:

- transparent
- zero-margin
- fullscreen canvas
- responsive
- menggunakan shared Character Resolver
- menggunakan shared Renderer
- menerima AvatarParameters

# Debug Mode

```text
?debug=1
```

Menampilkan:

- FPS
- connection state
- project ID
- sequence
- render status

## PASS Criteria

- avatar muncul
- transparency bekerja
- Talk bekerja
- Blink bekerja
- Talk + Blink bekerja
- reconnect setelah page refresh

# STEP 6 — Live Broadcast Control Panel & OBS Vertical Slice

## Desktop UI

Minimal:

### Preview

- Real-Time Avatar Preview

### Input

- Talk Simulator
- Blink Simulator
- Auto Blink
- Mic Enable
- Microphone Selector

### Audio

- Audio Meter
- Threshold
- Sensitivity
- Release Delay

### Broadcast

- Project ID
- Server Status
- Resolved Port
- Active Client Count
- OBS URL
- Copy URL

# Target

```text
NVL Desktop
↓
Parameters
↓
Resolver
↓
Preview
```

dan:

```text
NVL Desktop
↓
WebSocket
↓
Local Server
↓
OBS Browser Source
↓
Transparent Avatar
```

# FIRST MAJOR GATE

STEP 6 harus PASS sebelum Character Creator lengkap dibuat.

Test:

- OBS Browser Source reload
- reconnect
- server restart
- port conflict
- VAD
- Talking + Blink

# STEP 7 — Desktop Project Persistence

## Project Operations

Implementasikan:

- New
- Open
- Save
- Save As

# Structure

```text
MyAvatar/
├── project.nvl
└── assets/
    ├── body.png
    ├── eye-open.png
    ├── eye-closed.png
    ├── mouth-open.png
    └── mouth-closed.png
```

# Manifest

`project.nvl` menyimpan:

- schemaVersion
- projectId
- metadata
- canvas
- assets
- layers
- semantic roles
- parameters configuration
- animation configuration
- audio configuration
- output configuration

# Important Future Compatibility

Gunakan schema version sejak awal:

```json
{
  "schemaVersion": 1
}
```

Jangan membuat format project yang menganggap semua layer akan selalu sprite.

Project format harus dapat ditingkatkan di masa depan untuk menyimpan:

- mesh
- deformers
- rig parameters
- physics

tanpa merusak project lama.

Jangan implementasikan data tersebut sekarang.

# Asset Storage

Gunakan relative path.

Jangan Base64 PNG sebagai persistence utama.

# STEP 8 — Character Creator Foundation

## PNG Import

MVP:

- PNG
- transparent PNG

# Layer Editor

Support:

- import
- rename
- select
- reorder
- hide/show
- delete
- position
- scale
- rotation
- opacity

# Canvas

Support:

- pan
- zoom
- selection
- transform

# Layer Tree

Gunakan konsep tree/list yang nantinya dapat berkembang menjadi hierarchy.

Untuk MVP:

```text
Body
Eyes
Mouth
Hair
Accessory
```

Future:

```text
Root
└── Body Deformer
    └── Head Deformer
        ├── Face
        ├── Eyes
        └── Mouth
```

Jangan implementasikan deformer hierarchy sekarang.

# STEP 9 — Semantic Layer Assignment

Role minimum:

- Body
- Eye Open
- Eye Closed
- Mouth Open
- Mouth Closed
- Accessory
- Custom

Setelah assignment:

- Talk
- Blink
- Mic VAD

harus langsung bekerja menggunakan avatar milik user.

# STEP 10 — Animator Configuration

MVP Animator harus sederhana.

## Idle

- enabled
- vertical bob
- amplitude
- speed

## Blink

- enabled
- minimum interval
- maximum interval
- duration

## Talking

- threshold
- sensitivity
- release delay

## Audio Calibration

Tambahkan:

```text
Auto Calibrate
```

Pipeline:

```text
Ambient Noise
↓
Noise Floor
↓
Recommended Threshold
```

# Scope Limit

Belum implementasikan:

- mesh animation
- physics
- full timeline
- graph editor
- bone rigging
- face tracking

# STEP 11 — MVP Hardening & Windows Release

## Stability

Test:

- long-running session
- OBS reconnect
- WebSocket reconnect
- mic disconnect/reconnect
- project save/open
- corrupted project
- missing assets
- port conflict
- Electron renderer reload
- application restart

# Performance

Profile:

- CPU
- memory
- renderer FPS
- WebSocket traffic
- input reaction latency

# UX

Tambahkan:

- empty states
- loading states
- error handling
- mic permission states
- server states
- unsaved changes warning

# Windows Build

Output:

- Windows installer
  atau
- portable build

Tambahkan:

- application icon
- product version
- metadata
- production security settings

# FINAL PNGTUBER MVP FLOW

User harus dapat:

```text
Install NVL
↓
Create Project
↓
Import PNG
↓
Arrange Layers
↓
Assign Roles
↓
Configure Mic
↓
Preview
↓
Save
↓
Start Live Output
↓
Copy OBS URL
↓
Paste to OBS
↓
Stream
```

# PNGTUBER MVP COMPLETE

Setelah Step 11 PASS:

**jangan langsung membuat mesh rigging.**

Mulai dengan peningkatan PNGtuber yang menggunakan Parameter System yang sudah ada.

# STEP 12 — Expressions & Hotkeys

Tambahkan expression system.

Contoh:

- Neutral
- Happy
- Angry
- Sad
- Shock
- Embarrassed
- Custom

# Parameters

Tambahkan:

```text
expression
```

atau parameter expression yang lebih generic.

# Hotkeys

User dapat:

```text
F1 → Happy
F2 → Angry
F3 → Shock
```

Support custom hotkeys.

# OBS

Expression harus tersinkron melalui protocol yang sama.

# STEP 13 — Multi-Frame Mouth & Continuous Parameter Mapping

Upgrade sistem:

```text
Closed
Open
```

menjadi:

```text
Closed
Small
Medium
Wide
```

Gunakan:

```text
voiceLevel
```

untuk menentukan mouth frame.

Contoh:

```text
0.00–0.15 → Closed
0.15–0.35 → Small
0.35–0.65 → Medium
0.65–1.00 → Wide
```

# Future Compatibility

Perkenalkan parameter:

```text
mouthOpen: number
```

normalized:

```text
0.0–1.0
```

Ini menjadi jembatan menuju mesh rigging.

# STEP 14 — Simple Keyframe Animation

Tambahkan animation system sederhana.

Property awal:

- position
- scale
- rotation
- opacity

Support:

- keyframes
- interpolation
- easing
- loop

# Scope

Belum membuat:

- complex graph editor
- mesh keyframe deformation
- animation compositor besar

Tujuannya membangun konsep:

```text
Parameter
+
Time
→
Property
```

# STEP 15 — GPU Renderer & Rigging Architecture

Ini adalah awal **Rigging Era** NVL.

Sebelum membuat mesh editor, evaluasi renderer.

Canvas 2D tetap boleh digunakan untuk sprite compatibility.

Tambahkan GPU renderer untuk mesh.

Pilihan implementasi:

```text
WebGL
```

atau teknologi GPU browser/runtime yang matang pada saat implementasi.

Jangan mengganti renderer hanya karena tren.

Lakukan berdasarkan:

- stability
- Electron compatibility
- performance
- development complexity

# Renderer Architecture

Target:

```text
Renderer
├── SpriteRenderer
└── MeshRenderer
```

Character resolver tidak boleh bergantung langsung pada Canvas 2D.

# STEP 16 — Mesh Foundation

Tambahkan:

```ts
interface Vertex {
  x: number;
  y: number;

  u: number;
  v: number;
}

interface Mesh {
  vertices: Vertex[];
  indices: number[];
}
```

# Mesh Layer

Character model berkembang:

```text
CharacterLayer
├── SpriteLayer
└── MeshLayer
```

Contoh:

```ts
interface MeshLayer {
  id: string;
  type: "mesh";

  assetId: string;

  mesh: Mesh;
}
```

# Texture Mapping

PNG layer dapat ditempel sebagai texture pada mesh.

# STEP 17 — Mesh Editor

Tambahkan dedicated mesh editing mode.

Tools:

- Vertex Select
- Vertex Move
- Add Vertex
- Delete Vertex
- Edge
- Triangle
- Multi Select
- Box Select

# Auto Mesh

Tambahkan optional:

```text
Generate Mesh
```

tetapi hasilnya harus tetap editable manual.

# Mesh Visualization

Editor harus dapat menunjukkan:

- vertices
- edges
- triangles
- texture preview
- selected vertices

# STEP 18 — Parameter Rigging System

Sekarang Parameter System NVL mulai digunakan untuk rigging.

Contoh:

```text
Head X

-1.0 ───── 0 ───── +1.0
Left             Right
```

# Parameter Editor

User dapat:

```text
Create Parameter
↓
Create Keypoints
↓
Select Keypoint
↓
Deform Mesh
```

# Example Parameters

- Head X
- Head Y
- Head Rotation
- Body X
- Body Y
- Eye Open
- Mouth Open

# Important

Rigging parameters harus menggunakan Parameter Store yang sama dengan runtime PNGtuber.

Jangan membuat sistem parameter kedua.

# STEP 19 — Mesh Deformation & Interpolation

Parameter keypoint menyimpan mesh deformation.

Contoh:

```text
Head X

-1                0                +1
│                 │                 │
Mesh Left      Base Mesh         Mesh Right
```

# Runtime

Jika:

```text
Head X = 0.35
```

NVL menghitung interpolasi antara:

```text
Center
dan
Right
```

# Required

Implementasikan:

- vertex interpolation
- parameter interpolation
- clamp
- interpolation tests
- deterministic runtime

# STEP 20 — Deformer & Node Hierarchy

Tambahkan hierarchy.

Contoh:

```text
Root
└── Body Deformer
    ├── Torso
    └── Head Deformer
        ├── Face
        ├── Eyes
        ├── Mouth
        ├── Hair Front
        └── Hair Back
```

# Deformer Transform

Deformer minimal:

- position
- rotation
- scale

# Parent / Child

Jika parent bergerak:

```text
child mengikuti
```

tetapi child tetap memiliki:

```text
local transform
+
local deformation
```

# Character Graph

Pada tahap ini CharacterModel dapat berkembang menjadi:

```text
CharacterGraph
```

yang terdiri dari:

```text
nodes
layers
deformers
parameters
```

# STEP 21 — Physics System

Jangan mulai sebelum parameter rigging dan hierarchy stabil.

Physics digunakan untuk:

- hair
- ribbons
- accessories
- ears
- tails
- clothing

# Basic Physics

Mulai dari:

```text
Spring
Damping
Gravity
Inertia
```

# Pipeline

```text
Rig Parameter
↓
Deformer
↓
Physics
↓
Final Transform
↓
Renderer
```

# Important

Physics harus optional.

Project tanpa physics tetap bekerja.

# STEP 22 — Face Tracking

Setelah rigging stabil, tambahkan real-time tracking.

Pipeline:

```text
Camera
↓
Face Tracker
↓
Tracking Parameters
↓
Parameter Store
↓
Rig
↓
Physics
↓
Renderer
```

# Mapping

Contoh:

```text
FaceYaw
→ Head X

FacePitch
→ Head Y

EyeBlinkLeft
→ Eye Open Left

EyeBlinkRight
→ Eye Open Right

MouthOpen
→ Mouth Open
```

# Calibration

Tambahkan:

- neutral calibration
- range calibration
- smoothing
- dead zone
- sensitivity

# Architecture Requirement

Face tracking tidak boleh mengubah mesh secara langsung.

Tracking hanya menghasilkan parameter.

# STEP 23 — Advanced Rigging Tools

Setelah basic rigging terbukti stabil, tambahkan workflow profesional.

Candidate features:

- parameter presets
- mirrored deformation
- deformation copy/paste
- parameter linking
- multi-parameter blending
- deformation reset
- mesh smoothing
- weight tools
- grid warp
- advanced interpolation
- rig inspector

# Optional Future Features

Dapat dipertimbangkan setelah basic rigging matang:

- rotation deformers
- path deformers
- warp deformers
- masks
- clipping
- blend modes

# STEP 24 — Virtual Camera & Advanced Output

Setelah avatar runtime stabil, baru tambah output lain.

# Output Architecture

Gunakan konsep:

```text
OutputTarget
```

# Existing

```text
BrowserOutput
```

untuk OBS.

# Future

```text
VirtualCameraOutput
NDIOutput
SpoutOutput
```

sesuai kebutuhan dan platform support.

# Virtual Camera

Membuka dukungan ke:

- Discord
- Zoom
- Google Meet
- streaming software lain

# FINAL LONG-TERM NVL PIPELINE

Target arsitektur jangka panjang:

```text
                    NVL

            Character Creator
                    ↓
               Layer Tree
                    ↓
        Sprite / Mesh Components
                    ↓
            Parameter System
                    ↓
         Animation / Keyframes
                    ↓
              Rig Resolver
                    ↓
           Mesh Deformation
                    ↓
               Physics
                    ↓
                Renderer
                    ↓
         Real-Time Live Runtime
                    ↑
        ┌───────────┼───────────┐
        │           │           │
     Mic/VAD     Hotkeys    Face Tracking
        │           │           │
        └───────────┼───────────┘
                    ↓
              Parameter Store
                    ↓
        Browser / Virtual Camera
                    ↓
           OBS / Discord / etc.
```

# PRODUCT MODES

Dalam jangka panjang NVL dapat memiliki workspace:

```text
PROJECT
```

Project management.

```text
DRAW
```

Basic character drawing — future.

```text
CHARACTER
```

Layer composition dan asset management.

```text
RIG
```

Mesh, deformers, parameters.

```text
ANIMATE
```

Keyframe animation dan behaviour.

```text
TRACKING
```

Mic dan face-tracking configuration.

```text
LIVE
```

Real-time preview.

```text
OUTPUT
```

OBS, Virtual Camera, dan output lainnya.

# DRAWING TOOLS

Drawing application tetap bukan prioritas.

Jangan membangun Krita/Clip Studio replacement.

Jika suatu hari ditambahkan, scope awal cukup:

- Brush
- Eraser
- Layers
- Color Picker
- Selection
- Transform

Drawing workflow harus membantu pembuatan avatar, bukan menjadi general-purpose painting software.

# OUT OF SCOPE UNTIL PNGTUBER MVP COMPLETE

Sebelum STEP 11 PASS, jangan implementasikan:

- mesh rigging
- mesh editor
- deformer system
- physics
- face tracking
- full drawing application
- PSD editor
- advanced animation timeline
- keyframe graph editor
- Virtual Camera
- Discord integration
- cloud/public URL
- account system
- AI animation
- marketplace
- plugin marketplace
- mobile app

# IMPLEMENTATION RULE

Setiap step wajib:

```text
Plan
↓
Implement
↓
Typecheck
↓
Lint
↓
Unit Test
↓
Build
↓
Manual Verification
↓
Review
↓
PASS
↓
Next Step
```

# HARD GATES

## Gate 1 — STEP 6

Harus terbukti:

```text
NVL
→ Talk / Blink / Mic
→ OBS
```

sebelum Character Creator dikembangkan penuh.

## Gate 2 — STEP 11

Harus terbukti:

```text
Install
→ Import PNG
→ Configure Avatar
→ Save
→ OBS
→ Stream
```

sebelum rigging dikembangkan.

## Gate 3 — STEP 20

Harus terbukti:

```text
Mesh
→ Parameter
→ Deformation
→ Hierarchy
→ Real-Time Renderer
```

sebelum physics atau face tracking ditambahkan.

# FINAL PRODUCT GOAL

NVL tidak hanya menjadi:

> aplikasi yang mengganti gambar PNG ketika user berbicara.

Target jangka panjangnya adalah:

> desktop 2D avatar creation and live-animation studio yang memungkinkan creator mengimpor atau membuat artwork, membangun avatar berbasis sprite maupun mesh, melakukan parameter-based rigging dan animation, mengontrol avatar melalui microphone atau face tracking, dan mengirim hasilnya secara real-time ke software streaming.

Namun setiap lapisan kompleksitas hanya ditambahkan setelah lapisan sebelumnya terbukti stabil.
