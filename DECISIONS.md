# Architecture Decision Records (ADR) — NVL

Dokumen ini mendokumentasikan keputusan arsitektur utama pemilihan teknologi dalam NVL sebagai panduan bagi kontributor dan pengembang.

---

## ADR 001: Runtime Desktop — Electron (Bukan Tauri)

### Status
Accepted

### Konteks
NVL membutuhkan integrasi desktop yang stabil di Windows dengan kemampuan:
1. Menjalankan embedded Node.js HTTP dan WebSocket server lokal (`127.0.0.1`) dengan kontrol socket tingkat rendah untuk broadcast ke OBS Browser Source.
2. Akses native audio input (Web Audio API / `getUserMedia`) dengan perizinan konsisten.
3. IPC aman untuk manipulasi file sistem (`project.nvl` dan folder `assets/`).
4. Rendering engine Chromium yang konsisten dengan runtime OBS Browser Source (Chromium Embedded Framework / CEF).

### Alternatif Dipertimbangkan
- **Tauri**: Menghasilkan binary sangat kecil dan hemat memori, tetapi menggunakan WebView2 pada Windows. Menjalankan embedded WebSocket server lokal membutuhkan runtime Rust tambahan, dan perilaku rendering canvas Chromium di CEF OBS lebih mudah disinkronkan dan di-debug secara deterministik ketika frontend dan embedded server berjalan di ekosistem Chromium/Node.js yang seragam.
- **Pure Web App**: Memiliki masalah keterbatasan browser sandbox saat berinteraksi dengan OBS (keterbatasan permission mic cross-process, ketidakmampuan bind port lokal secara bebas, dependensi internet/cloud).

### Keputusan
Menggunakan **Electron** dengan baseline keamanan ketat (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, explicit IPC bridge).

---

## ADR 002: Frontend Framework — React 19 (Bukan Vue/Svelte)

### Status
Accepted

### Konteks
UI NVL Desktop memerlukan komposisi panel modular (Preview, Inspector, Layer List, Audio Meter, Broadcast Settings, Modal Dialogs) dengan reaktivitas tinggi.

### Alternatif Dipertimbangkan
- **Vue 3 / Svelte 5**: Sangat reaktif dan performan, tetapi ekosistem desktop component tooling, audio visualizer libraries, dan integrasi TypeScript di React 19 menawarkan fleksibilitas jangka panjang dan kompatibilitas standar industri yang luas.
- **React 18**: Stabil, namun React 19 (Stable) membawa peningkatan compiler, optimasi action/transition hooks, dan performa rendering tanpa re-render berlebih.

### Keputusan
Menggunakan **React 19 (Stable) + TypeScript + Vite**. Core state avatar dipisahkan ke dalam subsystem framework-agnostic (`core/parameters/`), sehingga React hanya mengatur UI/shell dan tidak memperlambat loop render 60 FPS pada Canvas 2D.

---

## ADR 003: Rendering Engine — HTML5 Canvas 2D (Bukan WebGL / PixiJS)

### Status
Accepted

### Konteks
NVL adalah avatar PNGtuber 2D berbasis tumpukan gambar (layers) dengan transformasi (posisi, skala, rotasi, opacity, z-index).

### Alternatif Dipertimbangkan
- **PixiJS / WebGL**: Memberikan pipeline shader GPU yang powerful, namun menambahkan footprint dependensi yang besar (~500KB+), kompleksitas context loss pada OBS Browser Source saat GPU load tinggi (misal saat streamer bermain game berat), dan overhead berlebih untuk sekadar menggambar 5–15 tumpukan sprite PNG 2D.
- **DOM / CSS Layers**: Sederhana, namun performa compositing CSS pada browser source OBS rentan terhadap micro-stuttering dan tidak dapat diekspor secara deterministik menjadi frame/drawing canvas.

### Keputusan
Menggunakan **Modular HTML5 Canvas 2D Renderer**. Ringan, zero-dependency, deterministik, hardware-accelerated di Chromium CEF, dan sangat mudah diekspansi untuk fitur kuas/drawing tool di masa mendatang.

---

## ADR 004: Real-Time Synchronization — `ws` (Bukan Socket.IO)

### Status
Accepted

### Konteks
Sinkronisasi antara NVL Desktop Controller dan OBS Browser Source terjadi secara lokal (`127.0.0.1`). NVL mengirimkan frame state parameter avatar (`voiceActivity`, `voiceLevel`, `blink`, sequence, timestamp) ke OBS.

### Alternatif Dipertimbangkan
- **Socket.IO**: Menyediakan HTTP long-polling fallback, room abstraction tingkat tinggi, dan reconnect logic. Namun, Socket.IO membawa overhead library client-server yang berat, polling handshake yang memperlambat koneksi awal, dan dependensi client khusus.
- **Native WebSocket (`ws`)**: Standar RFC 6455 murni, didukung langsung oleh browser Chromium tanpa client library tambahan (`new WebSocket(...)`), zero protocol overhead, latensi minimal, dan kontrol penuh atas penyimpanan initial snapshot serta penolakan sequence stale.

### Keputusan
Menggunakan pustaka **`ws`** di server Node.js dan native browser WebSocket API di client.

---

## ADR 005: Character Creator — In-House Canvas Interactions & Center Anchor Model

### Status
Accepted

### Konteks
Step 8 memperkenalkan Character Creator Foundation: import multi-PNG, layer management (reorder zIndex, rename, hide/show, delete), transform inspector, dan direct manipulation di Canvas Stage (hit-testing, dragging, 8-handle scaling, rotation stalk, pan, zoom, keyboard nudges).

### Alternatif Dipertimbangkan
- **Konva.js / Fabric.js / react-dnd**: Framework besar dengan bundle footprint 300KB–800KB. Membawa kompleksitas abstraksi object tree tersendiri, duplikasi scene graph yang sulit disinkronkan dengan `ProjectManifest.layers` immutable state NVL, dan overhead event synthetic.
- **Top-Left Anchor (0, 0)**: Memudahkan perhitungan bounding box sederhana, namun menghasilkan rotasi dan scaling yang tidak natural bagi avatar (avatar berputar di sudut kiri atas kepala dan membesar miring ke kanan bawah).

### Keputusan
1. **Zero External Canvas/Drag Dependencies**: Menggunakan native Pointer Events (`setPointerCapture`), CSS transforms untuk viewport pan/zoom, dan Canvas 2D overlay rendering.
2. **Center Anchor Model `[-w/2, -h/2]` to `[w/2, h/2]`**: Koordinat `(layer.x, layer.y)` selalu merepresentasikan titik tengah layer. Hit-testing mentransformasikan cursor screen ke local center space dengan translasi `(-x, -y)`, rotasi balik `-rotation`, dan pembagian `(scaleX, scaleY)`.
3. **Staging Directory untuk Proyek Untitled**: Asset PNG yang diimpor sebelum user menekan "Save As" disimpan di staging folder lokal (`temp/nvl_staging/assets`) dan otomatis disalin ke direktori proyek tujuan saat disimpan.

