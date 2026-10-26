SiLaporFasum Admin — Perbaikan Simpan Status v13

Paket ini memakai source code admin terbaru yang dikirim pengguna sebagai dasar.

PERUBAHAN:
- Update status meminta count=exact untuk memeriksa jumlah baris yang benar-benar terkena UPDATE.
- Setelah update, aplikasi membaca ulang ID dan status dari Supabase untuk memverifikasi hasilnya.
- Error permission/RLS, constraint status, dan tidak ada baris yang berubah ditampilkan dengan penjelasan spesifik.
- Cache-busting di index.html dinaikkan ke v13 agar browser tidak menggunakan admin.js lama.
- SQL migration memberikan GRANT SELECT/UPDATE eksplisit kepada authenticated, menghapus policy UPDATE yang terlalu luas, dan membuat ulang policy admin khusus admin@gmail.com.

CARA PASANG:
1. Backup repo admin.
2. Ganti index.html, admin.js, admin.css, dan admin-petugas.css di ROOT repositori GitHub Pages menggunakan file pada ZIP ini.
3. Buka SQL_PERBAIKAN_STATUS_ADMIN_V13.sql dan jalankan di SQL Editor Supabase project ytasgufassdscmxnjeyr. Pastikan login admin memang admin@gmail.com.
4. Commit file website dan tunggu GitHub Pages selesai deploy.
5. Logout dari website admin lalu login kembali dengan admin@gmail.com.
6. Tekan Ctrl+Shift+R.
7. Buka detail laporan, ubah status menjadi Diverifikasi atau Sedang Diproses, lalu klik Simpan Perubahan.
8. Periksa tabel public.laporan berdasarkan ID yang sama.

PENTING:
- Paket ini belum mengubah repositori GitHub atau menjalankan SQL secara otomatis.
- Jangan mengaktifkan SELECT publik untuk seluruh tabel laporan.
- Jangan memasukkan service_role/secret key ke frontend.
- Jika masih gagal, pesan toast v13 dan error Console sekarang harus menunjukkan apakah masalahnya izin, ID, constraint, atau verifikasi SELECT.
