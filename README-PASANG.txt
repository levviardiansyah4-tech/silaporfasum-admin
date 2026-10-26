SiLaporFasum Admin — Perbaikan Simpan Status v12

Paket ini ditujukan untuk repositori silaporfasum-admin.

File di ZIP berada langsung di root: index.html, admin.js, admin.css, admin-petugas.css.

Yang diubah:
- index.html memakai URL cache baru admin.js?v=20261026-status-save-v12 agar browser tidak memakai JavaScript lama.
- admin.js menyimpan status lebih dahulu, lalu menyimpan detail penugasan jika berubah. Jadi error pada kolom penugasan tidak membatalkan status yang sudah tersimpan.
- Status diverifikasi dengan hasil UPDATE Supabase sebelum menampilkan pesan berhasil.
- Jika email sesi bukan admin@gmail.com, aplikasi menampilkan pesan yang jelas.
- Pesan error Supabase ditampilkan dengan kode dan penjelasan lebih spesifik.

Pemasangan:
1. Backup repo sebelum mengganti file.
2. Ganti empat file pada root repo GitHub, bukan di dalam folder baru.
3. Commit changes, tunggu GitHub Pages selesai deploy.
4. Buka halaman admin dan tekan Ctrl+Shift+R.
5. Di DevTools > Console pastikan terlihat: [SiLaporFasum v12] ... atau SiLaporFasum Admin JavaScript v12 loaded.
6. Login dengan admin@gmail.com, ubah status, lalu Simpan Perubahan.
7. Jika gagal, kirimkan pesan toast atau error Console terbaru. Jangan jalankan SQL tambahan sebelum melihat pesan error tersebut.

Catatan: Paket ini belum diterapkan otomatis ke GitHub atau Supabase.
