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

---

## ADR 006: Semantic Layer Assignment & Auto-Rigging Rules

### Status
Accepted

### Konteks
Step 9 memperkenalkan Semantic Layer Assignment untuk memetakan tumpukan layer visual ke parameter animasi live (berbicara dan berkedip).

### Keputusan Arsitektur
1. **Aturan Keunikan Role (Unique vs Non-Unique)**:
   - 5 Role inti (`body`, `eye_open`, `eye_closed`, `mouth_closed`, `mouth_open`) bersifat unik (hanya boleh dimiliki oleh 1 layer).
   - Menetapkan role unik yang sudah dipakai layer lain memicu dialog konfirmasi penugasan ulang (`confirm`). Jika disetujui, layer lama otomatis di-reset menjadi `custom`.
   - Role `accessory` dan `custom` bersifat non-unik (dapat ditetapkan ke banyak layer sekaligus).
2. **First-Match-Wins Auto-Assign Heuristics**:
   - Deteksi otomatis regex nama file/layer menggunakan pola umum (`eye.*open`, `mouth.*close`, `body`, dsb.).
   - Bila terdapat beberapa layer yang cocok dengan role unik yang sama, layer urutan pertama yang mendapatkan role tersebut untuk menjamin determinisme.
3. **Non-Blocking Informative Validation**:
   - Peringatan ketiadaan role inti ditampilkan melalui `ValidationBanner` dan `ControlsPanel` secara spesifik dan edukatif tanpa memblokir penyimpanan file (`project.nvl`).
4. **Decoupled Resolver**:
   - `CharacterResolver.ts` tidak dimodifikasi karena sejak awal telah didesain mengevaluasi `layer.role` secara murni dan deterministik.

---

## ADR 007: Animator Configuration, Render Loop Deduplication & Deterministic Idle Bobbing

### Status
Accepted

### Konteks
Step 10 memperkenalkan konfigurasi animator (idle bobbing avatar, auto-blink tuning, mikrofon VAD, dan auto-kalibrasi kebisingan ambient).

### Keputusan Arsitektur
1. **Sinusoidal Idle Bob Engine (`IdleBobEngine`)**:
   - Menghitung offset vertikal Y secara deterministik menggunakan formula: `Math.sin(timeSeconds * speed * Math.PI * 2) * amplitude`.
   - Hanya diaplikasikan pada layer ber-role `body` saat avatar hening (`!parameters.voiceActivity`).
   - Gerakan bob otomatis jeda (pause) saat berbicara dan melanjutkan secara mulus saat hening kembali tanpa lompatan (glitch).
2. **Render Loop Deduplication (Single rAF)**:
   - Menghindari pembuatan multiple `requestAnimationFrame` render loops.
   - Baik di `CanvasStage` (preview) maupun di `LiveOutputApp` (OBS Browser Source), idle bob dievaluasi dalam satu loop frame terpadu saat `idleConfig.enabled` aktif.
   - Ketika idle bob dinonaktifkan, rendering beralih kembali ke event-driven (perubahan parameter via WebSocket atau ParameterStore).
3. **90th Percentile Noise Calibration (`AudioCalibrator`)**:
   - Mengabaikan lonjakan audio transien (batuk, decak lidah, klik mouse) dengan menghitung persentil ke-90 sampel ambient room selama 2 detik.
   - Rekomendasi threshold: `noiseFloor + 30%` (atau margin kustom), dibatasi aman pada rentang `[0.02, 0.50]`.
4. **Immediate Reschedule pada BlinkScheduler**:
   - `BlinkScheduler.updateConfig()` secara instan membersihkan timer berjalan dan menjadwalkan siklus kedip baru dengan rentang interval terbaru tanpa menunggu timer lama selesai.
5. **Backward Compatibility Manifest Schema**:
   - Menambahkan field opsional `idleConfig?: IdleConfig` dan `blinkConfig?: BlinkSettings` pada `ProjectManifest`. Proyek lama tanpa kedua field ini tetap valid dan otomatis menggunakan nilai default.

---

## ADR 008: MVP Hardening, Windows Release Packaging & Resilience Architecture

### Status
Accepted

### Konteks
Step 11 merupakan penutup Stage B (Gate 2: MVP Hardening & Windows Release). Fokusnya adalah menjamin stabilitas aplikasi untuk sesi streaming 30+ menit tanpa crash, memaketkan installer Windows (NSIS & Portable), serta menangani seluruh edge case kegagalan (project file korup, tabrakan port, pemutusan mikrofon mendadak, beban render layer tersembunyi).

### Keputusan Arsitektur
1. **Distribusi Windows Ganda (NSIS + Portable)**:
   - Dikonfigurasi via `electron-builder` (`win.target: ["nsis", "portable"]`).
   - Output installer: `dist/releases/NVL Setup 0.1.0.exe` (dengan opsi kustomisasi direktori instalasi) dan `dist/releases/NVL 0.1.0.exe` (portable zero-install).
   - Icon aplikasi multi-resolusi format Windows ICO valid di `public/assets/icon.ico`.
2. **Single Instance Lock**:
   - Memanfaatkan `app.requestSingleInstanceLock()`. Peluncuran instans kedua otomatis fokus/restore ke jendela instans aktif dan menghentikan instans duplikat untuk mencegah tabrakan port local server dan database file lock.
3. **Strict Content Security Policy (CSP)**:
   - Header meta CSP ketat di `index.html`: membatasi `connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*`, font Google Fonts (`https://fonts.googleapis.com https://fonts.gstatic.com`), serta menolak koneksi eksternal yang tidak diotorisasi.
4. **Production Hardening & Clean Exit**:
   - Pembungkaman `console.log` otomatis pada production build (`app.isPackaged`) untuk menghemat buffer I/O.
   - Hook lifecycle `app.on('will-quit')` dan `before-quit` memastikan server lokal HTTP/WebSocket berhenti bersih tanpa meninggalkan proses zombie `node.exe`.
5. **Auto-Backup & Crash Resilience**:
   - `saveProject()` otomatis membuat salinan `<project>.nvl.bak` sebelum menimpa file yang ada di disk.
   - Penanganan file korup non-destruktif: `openProject()` tidak menimpa `.bak` valid, dan menyediakan helper `restoreBackup()` jika file utama rusak.
   - React `ErrorBoundary` menangkap exception unhandled pada render UI, menyediakan opsi "Reload Application" dan unduhan darurat "Export Crash Report" format JSON.
6. **Hardware & Port Conflict Handling**:
   - `AudioVAD.onDeviceDisconnected`: memantau status `MediaStreamTrack.onended` dan menampilkan peringatan native dialog jika perangkat mikrofon dicabut saat streaming.
   - `resolveAvailablePort`: memindai port incremental secara dinamis mulai dari 17777 hingga 17807 jika port preferensi sedang digunakan aplikasi lain.
7. **Invisible Layer Render Optimization**:
   - Pada `CanvasAvatarRenderer`, layer dengan `visible === false` atau `opacity <= 0` dilewati (skip) sebelum operasi `ctx.save()`, affine transformations (`translate`, `rotate`, `scale`), dan `drawImage()`, mempertahankan kestabilan 60 FPS pada rig avatar kompleks.
8. **UX Polish (Welcome Screen & Loading Overlays)**:
   - Tampilan pembuka ramah pemula saat belum ada proyek yang dibuka, dengan 3 kartu aksi utama: "Create New Project", "Open Existing Project", dan "Open Sample Avatar" (Chibi Cat).
   - Loading overlay dengan spinner animasi selama operasi I/O proyek, serta bridge pesan native dialog via `dialog.showMessageBox`.



