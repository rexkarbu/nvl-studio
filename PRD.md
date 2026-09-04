# NVL — Product Requirements Document

## 1. Product Overview

### Nama sementara

**NVL**

### Kategori

Desktop Creator Tool / PNGtuber / Live Streaming Avatar Software

### Product Vision

NVL adalah aplikasi desktop all-in-one untuk membuat, menganimasikan, dan menampilkan avatar PNGtuber secara live tanpa harus berpindah antara beberapa aplikasi berbeda.

User dapat:

1. Mengimpor aset karakter.
2. Menyusunnya sebagai avatar berbasis layer.
3. Menentukan ekspresi dan state animasi.
4. Menghubungkannya dengan input microphone.
5. Melihat hasilnya secara real-time.
6. Mengirim avatar transparan ke OBS atau software streaming lainnya.

### Core Product Loop

**Import Character → Build Avatar → Animate → Connect Mic → Preview → Go Live**

User harus dapat melewati keseluruhan alur tersebut tanpa keluar dari NVL.

---

# 2. Problem Statement

Workflow PNGtuber biasanya tersebar di beberapa tool.

User mungkin harus menggunakan:

- drawing software untuk membuat aset;
- image editor untuk memisahkan layer;
- PNGtuber software untuk mengatur avatar;
- tool tambahan untuk animation;
- OBS untuk streaming.

Workflow tersebut meningkatkan friction untuk creator baru.

NVL bertujuan menggabungkan bagian terpenting dari workflow tersebut ke dalam satu lingkungan kerja.

---

# 3. Product Principles

NVL harus memprioritaskan:

### Fast Setup

Creator sederhana harus dapat membuat avatar live tanpa memahami rigging kompleks.

### Visual First

Sebagian besar konfigurasi dilakukan melalui editor visual dan preview real-time.

### Non-Destructive

File gambar asli tidak boleh dimodifikasi secara permanen.

### Low Latency

Reaksi avatar terhadap microphone harus terasa langsung.

### Streaming Friendly

Output harus mudah dipakai sebagai source transparan di software streaming.

### Progressive Complexity

User baru dapat menggunakan sistem sederhana.

User tingkat lanjut nantinya dapat menggunakan:

- banyak ekspresi;
- animation timeline;
- hotkey;
- parameter;
- trigger;
- advanced rigging.

---

# 4. Target Users

## Primary User

### Beginner PNGtuber

Creator yang ingin mulai streaming menggunakan avatar tetapi tidak ingin belajar software rigging kompleks.

Kebutuhan:

- setup cepat;
- workflow sederhana;
- mic-reactive avatar;
- integrasi OBS;
- tidak membutuhkan pengetahuan animation profesional.

---

## Secondary User

### Artist / PNGtuber Creator

Artist yang sudah membuat aset sendiri menggunakan Krita, Photoshop, Clip Studio Paint, atau software lainnya.

Kebutuhan:

- import layer;
- kontrol avatar lebih detail;
- preview animasi;
- expression;
- reusable character project.

---

## Future User

### Advanced Streamer

Streamer yang membutuhkan:

- hotkey;
- multiple expression;
- scene state;
- advanced animation;
- integrations;
- plugins;
- automation.

Advanced workflow bukan target MVP.

---

# 5. Main Application Structure

Untuk MVP aplikasi dibagi menjadi lima workspace utama.

## Project

Mengelola project karakter.

## Character

Mengatur visual avatar dan layer.

## Animate

Mengatur state dan animation sederhana.

## Live

Mengatur microphone dan live behaviour.

## Output

Mengatur output untuk streaming software.

---

# 6. Project System

Setiap avatar disimpan sebagai sebuah **NVL Project**.

Project menyimpan:

- project metadata;
- imported assets;
- layer configuration;
- transform;
- animation states;
- microphone configuration;
- output configuration.

Contoh struktur konseptual:

```text
MyCharacter/

project.nvl

assets/
    body.png
    eyes-open.png
    eyes-closed.png
    mouth-closed.png
    mouth-open.png

config/
    character
    animation
    audio
    output
```

Implementasi sebenarnya tidak harus mengikuti struktur filesystem tersebut secara persis.

---

# 7. Character System

## 7.1 Canvas

User mendapatkan canvas untuk menyusun karakter.

Canvas mendukung:

- pan;
- zoom;
- move;
- scale;
- rotate;
- layer selection;
- visibility toggle.

---

# 7.2 Asset Import

MVP mendukung:

- PNG;
- transparent PNG.

Format tambahan seperti PSD dapat dipertimbangkan setelah MVP.

---

# 7.3 Character Layers

Avatar terdiri dari beberapa layer.

Contoh:

```text
Hair Front
Eyes
Eyebrows
Mouth
Face
Body
Hair Back
Accessories
```

User bebas memberi nama layer.

Setiap layer memiliki:

- position X/Y;
- scale;
- rotation;
- opacity;
- visibility;
- z-index.

---

# 7.4 Semantic Layer Roles

Layer tertentu dapat diberikan role.

Contoh:

```text
Body
Eye Open
Eye Closed
Mouth Closed
Mouth Open
Accessory
Custom
```

Role membantu NVL mengetahui layer mana yang harus berubah ketika avatar berbicara atau berkedip.

---

# 8. Character User Stories

### Import Character

Sebagai creator, saya ingin mengimpor gambar PNG sehingga saya dapat membuat avatar dari artwork yang sudah saya miliki.

### Arrange Layers

Sebagai creator, saya ingin mengatur posisi dan urutan layer sehingga bagian karakter dapat disusun dengan benar.

### Assign Layer Role

Sebagai creator, saya ingin menentukan fungsi suatu layer sehingga NVL mengetahui mata dan mulut mana yang harus dianimasikan.

### Preview Character

Sebagai creator, saya ingin melihat hasil karakter secara langsung ketika melakukan perubahan.

---

# 9. Animation System

MVP tidak menggunakan animation timeline kompleks.

Animation menggunakan **state-based animation**.

State utama:

```text
Idle
Talking
Blink
```

---

# 10. Idle State

Idle adalah kondisi default ketika microphone tidak mendeteksi suara.

Idle dapat memiliki subtle motion seperti:

- vertical bob;
- breathing;
- slight rotation.

Parameter sederhana:

```text
Amplitude
Speed
Delay
```

Motion harus optional.

---

# 11. Blink System

Blink dapat dijalankan otomatis.

User menentukan:

```text
Eye Open layer
Eye Closed layer
```

NVL kemudian membuat blink secara otomatis berdasarkan interval semi-random.

Contoh:

```text
Blink Interval
3–7 seconds
```

Tujuannya agar avatar tidak terlihat seperti blinking dengan timing mekanis.

---

# 12. Talking State

Talking state aktif ketika microphone melewati audio threshold tertentu.

Versi paling sederhana:

```text
Silence
→ Mouth Closed

Voice Detected
→ Mouth Open
```

NVL dapat melakukan pergantian gambar beberapa kali selama user berbicara sehingga terlihat seperti mouth-flapping.

---

# 13. Audio Input System

NVL harus dapat membaca microphone input real-time.

User dapat memilih input device.

Contoh:

```text
Microphone
USB Microphone
Virtual Audio Cable
```

User mendapatkan audio meter.

---

# 14. Voice Detection

Voice detection MVP menggunakan amplitude threshold.

Konfigurasi:

```text
Input Device

Sensitivity

Activation Threshold

Release Delay
```

Contoh:

```text
volume > threshold
→ Talking

volume < threshold
→ Idle
```

Release delay digunakan untuk mencegah avatar berpindah terlalu cepat antara talking dan idle.

---

# 15. Audio Calibration

Tombol:

**Auto Calibrate**

NVL membaca ambient microphone level beberapa detik.

Kemudian menyarankan threshold yang sesuai.

User tetap dapat mengubahnya secara manual.

---

# 16. Animation User Stories

### Idle Animation

Sebagai streamer, saya ingin avatar bergerak sedikit ketika diam sehingga karakter terasa hidup.

### Automatic Blink

Sebagai streamer, saya ingin karakter berkedip secara otomatis sehingga saya tidak perlu membuat trigger manual.

### Mic Reactive Talking

Sebagai streamer, saya ingin mulut karakter bergerak ketika saya berbicara sehingga avatar mengikuti suara saya.

### Animation Preview

Sebagai creator, saya ingin mencoba idle dan talking dari editor sebelum melakukan streaming.

---

# 17. Real-Time Preview

NVL memiliki viewport preview.

Mode:

```text
Edit Preview
Live Preview
```

Live Preview menjalankan:

- microphone detection;
- idle animation;
- blink;
- talking animation.

Preview harus menggunakan renderer yang sama atau sedekat mungkin dengan live output agar behaviour tidak berbeda saat streaming.

---

# 18. Live Mode

Ketika Live Mode aktif:

```text
Microphone
↓
Audio Analyzer
↓
Avatar State Controller
↓
Animation Engine
↓
Renderer
↓
Live Output
```

Target utama adalah latency yang cukup rendah sehingga gerakan avatar terasa sinkron dengan suara.

Target awal:

**perceived reaction latency <100 ms**, bila hardware memungkinkan.

---

# 19. Live Output

NVL menyediakan output transparan untuk streaming.

MVP terutama menargetkan:

**OBS Browser Source**

User menekan:

**Start Live Output**

NVL menjalankan local output server.

Contoh:

```text
http://127.0.0.1:PORT/avatar
```

Browser source menampilkan:

- avatar;
- animation;
- transparent background.

---

# 20. Output Controls

User dapat mengatur:

```text
Canvas Width

Canvas Height

FPS

Background
```

Default:

```text
1920 × 1080
30 FPS
Transparent
```

Preset tambahan dapat disediakan:

```text
Portrait
Landscape
Square
```

---

# 21. Output User Stories

### Browser Source

Sebagai streamer, saya ingin mendapatkan URL yang dapat dimasukkan ke OBS sehingga avatar saya tampil dalam streaming.

### Transparent Background

Sebagai streamer, saya ingin background transparan sehingga avatar dapat ditempatkan di atas game atau camera feed.

### Real-Time Synchronization

Sebagai streamer, saya ingin avatar di OBS menunjukkan state yang sama dengan preview NVL.

---

# 22. MVP User Journey

## Step 1 — Create Project

User memilih:

```text
New Character
```

---

## Step 2 — Import Assets

User memasukkan:

```text
body.png
eyes-open.png
eyes-closed.png
mouth-closed.png
mouth-open.png
```

---

## Step 3 — Arrange Character

User:

- mengatur posisi;
- mengatur scale;
- menentukan layer order.

---

## Step 4 — Assign Roles

User memilih:

```text
eyes-open.png → Eye Open

eyes-closed.png → Eye Closed

mouth-open.png → Mouth Open

mouth-closed.png → Mouth Closed
```

---

## Step 5 — Animation Setup

NVL otomatis menyediakan:

```text
Idle
Blink
Talking
```

User dapat mengatur parameter sederhana.

---

## Step 6 — Microphone Setup

User memilih microphone.

NVL menampilkan audio meter.

User menjalankan:

```text
Auto Calibrate
```

---

## Step 7 — Test

User memilih:

```text
Live Preview
```

Avatar mulai bereaksi terhadap suara.

---

## Step 8 — Start Output

User memilih:

```text
Start Output
```

NVL menampilkan Browser Source URL.

---

## Step 9 — OBS

User:

```text
OBS
→ Sources
→ Browser
→ Paste URL
```

Avatar tampil transparan.

---

# 23. MVP Acceptance Criteria

MVP dianggap **selesai** jika seluruh workflow berikut berjalan dalam build release tanpa workaround eksternal.

## Project

- User dapat membuat project.
- User dapat membuka project.
- User dapat menyimpan project.
- Project tetap dapat dibuka setelah aplikasi direstart.

## Assets

- PNG transparan dapat di-import.
- Multiple assets dapat digunakan dalam satu karakter.
- Asset asli tidak dimodifikasi.

## Layer Editor

- User dapat memilih layer.
- User dapat move layer.
- User dapat scale layer.
- User dapat rotate layer.
- User dapat mengubah layer order.
- User dapat hide/show layer.
- Semua transform tersimpan.

## Character State

Minimal tersedia:

- Idle;
- Blink;
- Talking.

## Blink

- User dapat menentukan eye-open.
- User dapat menentukan eye-closed.
- Automatic blink berjalan.
- Timing blink memiliki variasi.

## Talking

- User dapat menentukan mouth-open.
- User dapat menentukan mouth-closed.
- Microphone activity dapat mengaktifkan talking.
- Talking kembali menjadi idle setelah suara berhenti.

## Microphone

- Input device dapat dipilih.
- Audio level terlihat.
- Sensitivity dapat diubah.
- Threshold dapat diubah.
- Input microphone tidak direkam tanpa tindakan eksplisit user.

## Preview

- Avatar dapat di-preview secara real-time.
- Blink terlihat.
- Idle terlihat.
- Talking bereaksi terhadap microphone.

## Output

- NVL dapat menjalankan local output.
- URL output dapat dibuka di browser.
- OBS Browser Source dapat membuka URL tersebut.
- Background transparan.
- Avatar yang tampil sama dengan preview.
- Talking dan blink sinkron dengan Live Preview.

## Performance

Pada project avatar sederhana:

- UI tetap responsive.
- animation berjalan stabil pada 30 FPS;
- microphone reaction tidak terasa lambat;
- aplikasi tidak mengalami memory growth besar selama sesi streaming panjang.

---

# 24. Explicitly Out of Scope for MVP

Fitur berikut sengaja **tidak menjadi syarat MVP**:

- full drawing application;
- Photoshop-style brush engine;
- PSD editing;
- vector drawing;
- bone rigging;
- mesh deformation;
- physics simulation kompleks;
- face tracking;
- webcam tracking;
- AI-generated animation;
- automatic image segmentation;
- phoneme-based lip sync;
- timeline animation editor kompleks;
- keyframe graph editor;
- cloud account;
- asset marketplace;
- multiplayer;
- mobile app;
- plugin marketplace;
- native TikTok integration;
- Discord integration khusus;
- cloud-hosted public avatar URL.

Fitur tersebut dapat dikembangkan setelah core workflow terbukti stabil.

---

# 25. Phase 2 Candidates

Setelah MVP stabil:

### Expression System

Contoh:

```text
Happy
Angry
Sad
Surprised
Embarrassed
```

Trigger melalui hotkey.

### Multiple Mouth Frames

Contoh:

```text
Closed
Small
Medium
Wide
```

Audio amplitude menentukan mouth frame.

### Animation Editor

Simple keyframe system:

```text
Position
Scale
Rotation
Opacity
```

### Hotkey System

Contoh:

```text
F1 → Happy
F2 → Angry
F3 → Shock
```

### Character Presets

Save/load animation configuration.

### Scene Presets

Beberapa posisi atau costume.

---

# 26. Phase 3 Candidates

### Built-In Drawing

Basic:

- brush;
- eraser;
- layers;
- color picker;
- transform;
- selection.

Tidak perlu mencoba menggantikan Krita atau Clip Studio Paint.

### Advanced Lip Sync

Audio classification menjadi:

```text
Closed
A
E
I
O
U
```

### Face Tracking

Webcam dapat mengontrol:

- head position;
- blink;
- eyebrow;
- mouth.

### Animation Physics

Support:

- hair bounce;
- accessories;
- body sway.

---

# 27. Long-Term Product Direction

NVL dapat berkembang menjadi:

**Creator Studio**

untuk avatar streaming 2D ringan.

Arsitektur jangka panjang dapat memiliki pipeline:

```text
Assets
↓
Character Model
↓
Parameters
↓
State Machine
↓
Animation
↓
Input Controllers
↓
Renderer
↓
Output Targets
```

Input Controller nantinya dapat berasal dari:

```text
Microphone
Keyboard
MIDI
Stream Deck
Webcam
OSC
API
```

Output Target dapat berkembang menjadi:

```text
OBS
Virtual Camera
Transparent Window
NDI
WebRTC
Plugin/API
```

Hal terpenting adalah menjaga Character Model, Animation Engine, Input Controller, dan Output sebagai subsystem terpisah sehingga fitur baru tidak membuat core application saling terikat.

---

# 28. MVP Definition

NVL MVP bukan:

> Aplikasi untuk menggambar dan membuat PNGtuber profesional dari nol.

NVL MVP adalah:

> Aplikasi desktop yang memungkinkan creator mengimpor artwork PNG, menyusunnya menjadi avatar ber-layer, memberi idle/blink/talking behaviour, menghubungkannya ke microphone, lalu menampilkan avatar transparan secara real-time di OBS.

Jika workflow tersebut cepat, stabil, dan mudah dipahami, MVP berhasil.
