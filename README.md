# SiLaporFasum Admin — Perbaikan Simpan v10

Versi ini menambahkan pemeriksaan awal pada baris laporan dan pesan diagnostik yang lebih jelas untuk membedakan masalah ID/SELECT RLS dengan UPDATE RLS. Console juga mencatat email akun yang sedang login (jangan membagikan informasi sensitif selain yang diperlukan untuk diagnosis).

## Pasang file frontend
1. Ekstrak ZIP. File `index.html`, `admin.js`, `admin.css`, dan `admin-petugas.css` ada langsung di root ZIP.
2. Unggah/ganti empat file tersebut di root repository GitHub Pages yang benar, lalu Commit changes.
3. Tunggu deployment selesai, buka URL admin dan tekan `Ctrl+Shift+R`.
4. Di DevTools → Network, pastikan browser memuat `admin.js?v=20261026-fix-simpan-v10`. Di Console harus muncul `SiLaporFasum Admin JavaScript v10 loaded`.

## Jika status tetap tidak berubah
1. Tekan Simpan Perubahan dan baca toast merah. v10 akan menyebut apakah laporan tidak terlihat karena SELECT/RLS atau UPDATE tidak mengubah baris.
2. Jika pesan menyebut policy RLS, buka `SQL_PERBAIKAN_UPDATE_LAPORAN.sql`.
3. Ganti `EMAIL_ADMIN_ANDA@example.com` di dua bagian policy dengan email yang persis sama dengan akun yang digunakan untuk login ke aplikasi.
4. Jalankan SQL itu di Supabase → SQL Editor pada project `ytasgufassdscmxnjeyr`.
5. Logout lalu login kembali di aplikasi admin, buka laporan, ubah status, dan simpan.

Jangan jalankan SQL dengan placeholder email yang belum diganti. Jangan pernah menaruh service_role/secret key di frontend. Script hanya memberi SELECT dan UPDATE kepada akun authenticated yang email JWT-nya cocok; policy lain yang sudah ada tetap perlu ditinjau bila kebijakan akses project lebih kompleks.

`SQL_PERBAIKAN_REALTIME.sql` hanya untuk pembaruan realtime, bukan syarat tombol Simpan. `SQL_PERBAIKAN_HAPUS.sql` terpisah untuk fitur hapus.
