HAENO — NEON PREMIUM  (v0.2)

Isi project:
- index.html : login/register, workspace chat, sidebar riwayat, overlay transisi login.
- style.css  : tema neon magenta-violet (tampilan lama tidak diubah; gaya baru ada di bagian paling bawah).
- app.js     : autentikasi demo lokal, riwayat per akun, lampiran foto/file, markdown, balasan demo.
- logo.png   : logo HAENO.

Menjalankan (Android / SPCK Editor atau browser):
1. Ekstrak ZIP.
2. Buka index.html (SPCK: Preview).

Yang baru di v0.2:
- Label "LOCAL MODE" di kanan atas dihapus.
- Kirim foto & file lewat tombol klip di kolom chat:
  * Foto & galeri, Kamera (muncul di HP), dan File (PDF, dokumen, teks, kode).
  * Bisa juga drag & drop file ke area chat, atau paste gambar (Ctrl+V) di kolom ketik.
  * Pratinjau lampiran sebelum dikirim, bisa dihapus satu per satu.
  * Maks 6 lampiran per pesan, maks 20 MB per file.
  * Foto otomatis diperkecil (maks 1024px) agar ringan; klik foto di chat untuk membuka ukuran besar.
  * Pesan boleh hanya berisi lampiran tanpa teks.
  * Jika penyimpanan perangkat penuh, gambar lama dilepas otomatis agar riwayat teks tetap aman.
- Balasan AI sekarang tampil rapi (tebal, daftar, kode) -- sebelumnya tanda ** muncul apa adanya. Ada tombol SALIN.
- Tetap login setelah halaman di-refresh (logout menghapus sesi).
- Sidebar di desktop bisa dilipat dengan tombol ☰.
- Di HP: Enter = baris baru (kirim lewat tombol); di desktop: Enter = kirim.
- Perbaikan: logout saat AI sedang membalas tidak lagi menyebabkan error; balasan tidak nyasar ke obrolan lain.

Menghubungkan AI sungguhan:
- Buka app.js, isi CONFIG.apiUrl dengan endpoint backend milikmu.
- Backend menerima POST JSON { "messages": [ { role, text, attachments:[{name,type,size,kind,dataUrl,text}] } ] }
  (isi lampiran dataUrl/text hanya dikirim untuk pesan terakhir) dan membalas { "reply": "teks" }.
- Jangan taruh API key rahasia di frontend; simpan di server.
- Selama apiUrl kosong, balasan hanya demo lokal dan lampiran TIDAK dibaca/dianalisis.

Batasan:
- Login/register memakai localStorage (password tidak di-hash) -- hanya untuk demo, jangan pakai password asli.
- Diuji di Chromium headless (tampilan HP & desktop: login, kirim foto + file, markdown, refresh, menu lampiran).
  Belum diuji di perangkat Android sungguhan / SPCK Editor, dan tombol Kamera hanya muncul di layar sentuh.

HAENO AI — DEMO V1 UPDATE
- Empat pilihan aksen: biru default, hijau toska, crimson, dan putih elegan. Latar tetap gelap.
- Efek partikel quantum ringan berjalan di latar login dan workspace.
- Tombol Theme setting tersedia di sidebar, di bawah Obrolan baru.
- Loading tema menggunakan logo HAENO.
- Fitur Lupa password terhubung ke endpoint recovery Supabase setelah konfigurasi di app.js.

AKTIFKAN RESET PASSWORD SUPABASE
1. Buka HAENO_AI_Workspace/app.js.
2. Pada konstanta CONFIG, isi supabaseUrl dengan Project URL dari Supabase dan supabaseAnonKey dengan publishable/anon key proyek.
3. Di Supabase Authentication > URL Configuration, atur Site URL dan Redirect URLs untuk alamat web tempat HAENO dijalankan.
4. Pastikan pengiriman email Auth/SMTP Supabase dikonfigurasi jika ingin email reset dikirim dengan andal.

CATATAN PENTING: mode login/register pada demo ini masih memakai localStorage di perangkat, bukan Supabase Auth. Tombol reset meminta Supabase mengirim email recovery untuk akun Supabase; agar reset itu berlaku pada akun HAENO yang sama, tahap berikutnya adalah memindahkan login/register/session ke Supabase Auth. Jangan gunakan autentikasi localStorage untuk akun sungguhan.


LOGIN NOTE: This build retains the original local demo authentication. Register a demo account first, then log in with the same email and password on the same browser/storage. Supabase Auth is NOT connected yet because a Supabase publishable/anon key and Auth integration are still required.
