SiLaporFasum Admin — Fix status v14

Paket ini dibuat dari source ZIP admin terbaru yang diberikan pengguna (source sebelumnya memakai cache v12).

Urutan wajib:
1. Backup repositori admin dan database schema terlebih dahulu.
2. Buka SQL_FIX_STATUS_ADMIN_V14.sql di Supabase SQL Editor pada project ytasgufassdscmxnjeyr, lalu jalankan. Email admin yang diizinkan adalah admin@gmail.com.
3. Pastikan SQL berhasil tanpa error sebelum lanjut.
4. Salin index.html, admin.js, admin.css, admin-petugas.css ke ROOT repositori GitHub Pages admin. Jangan letakkan di folder pembungkus tambahan.
5. Commit changes dan tunggu GitHub Pages deploy.
6. Buka website admin, tekan Ctrl+Shift+R, login lagi dengan admin@gmail.com.
7. Buka detail satu laporan, ubah status menjadi Diverifikasi atau Sedang Diproses, lalu Simpan Perubahan.
8. Jika berhasil, toast menyatakan status tersimpan. Verifikasi tabel public.laporan pada baris ID yang sama.
9. Jika fungsi SQL belum terpasang, toast akan menyebut SQL_FIX_STATUS_ADMIN_V14.sql. Jika database mengembalikan error lain, salin pesan toast dan Console.

Yang berubah:
- Status disimpan lewat RPC `silapor_admin_update_status_v14` yang memverifikasi email admin, ID, nilai status, dan status aktual setelah update.
- Detail penugasan disimpan terpisah sehingga kesalahan kolom petugas/tanggal tidak membatalkan update status.
- Cache-busting pada CSS dan JS dinaikkan ke v14.

Catatan: paket belum diterapkan otomatis ke GitHub/Supabase. SQL harus dijalankan oleh pemilik proyek.
