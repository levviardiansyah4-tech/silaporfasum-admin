SiLaporFasum Admin — Fix Status v15

Paket ini memperbaiki wiring tombol Simpan Perubahan secara langsung.
Pada versi ini tombol detail memakai type="button" dan event click dipasang
langsung setelah form detail laporan dibuat. Dengan demikian, tombol tidak
bergantung pada event submit terdelegasi di modal.

Cara pasang:
1. Backup repositori admin.
2. Salin index.html, admin.js, admin.css, admin-petugas.css ke root repositori GitHub Pages.
3. Commit changes dan tunggu deployment selesai.
4. Buka website admin, tekan Ctrl+Shift+R.
5. Di Console harus muncul: "SiLaporFasum Admin JavaScript v15 loaded".
6. Buka detail laporan, pilih status, klik Simpan Perubahan.
7. Di Console harus muncul "[SiLaporFasum v15] Klik tombol Simpan Perubahan terdeteksi".
8. Jika tombol terdeteksi, cari log "[SiLaporFasum v15] Memanggil RPC update status" atau "[SiLaporFasum v15] Update status gagal".
9. Jika log klik tidak muncul, halaman belum memuat file v15 atau ada lapisan UI yang menutup/menghalangi tombol.
10. Jika log klik muncul tetapi update gagal, kirim seluruh log setelah klik dan pesan toast.

SQL v14 tidak diubah. Fungsi public.silapor_admin_update_status_v14(text,text)
yang sudah dikonfirmasi ada di Supabase tetap digunakan.
