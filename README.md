# SiLaporFasum Admin — Perbaikan Simpan Perubahan v7

Paket ini berisi perbaikan handler tombol **Simpan Perubahan**, pembaruan tampilan setelah Supabase mengonfirmasi perubahan, pesan error yang lebih jelas, dan cache-busting untuk mencegah browser memakai `admin.js` versi lama.

## Pasang file di GitHub Pages

1. Ekstrak ZIP.
2. Unggah file `index.html`, `admin.js`, `admin.css`, dan `admin-petugas.css` langsung ke **root** repository (sejajar, bukan di dalam folder tambahan).
3. Commit perubahan ke branch yang dipakai GitHub Pages.
4. Pastikan Settings → Pages mengarah ke branch dan folder yang benar.
5. Tunggu deployment selesai, buka URL Pages, lalu lakukan hard refresh (`Ctrl+Shift+R`).
6. Pada browser, buka DevTools → Network, muat ulang halaman, dan pastikan file yang dimuat bernama `admin.js?v=20261026-fix-simpan-v7`.

## Apa yang diperbaiki

- Tombol Simpan memakai event `submit` yang dipasang langsung pada form detail setiap kali detail dibuka, bukan event klik yang didelegasikan ke wadah modal.
- Data status, petugas, tanggal penugasan, tanggal target, dan catatan dikirim ke tabel `public.laporan`.
- Setelah database mengonfirmasi perubahan, daftar laporan dan ringkasan dashboard dimuat ulang.
- Pesan error bertahan lebih lama agar dapat dibaca. Error RLS dan nama kolom yang tidak cocok diberi petunjuk khusus.
- URL aset diberi versi untuk menghindari cache browser lama.

## Jika tombol tetap gagal

Tekan Simpan Perubahan lalu baca pesan merah yang muncul. Pesan itu menentukan langkah selanjutnya:

- **RLS / permission denied / 42501**: akun admin belum memiliki policy `UPDATE` dan `SELECT` yang sesuai pada `public.laporan`.
- **Kolom tidak ditemukan / PGRST204**: nama kolom pada kode berbeda dari skema tabel Supabase.
- **Tidak ada baris yang diperbarui**: periksa policy RLS `SELECT`/`UPDATE`, ID laporan, dan apakah akun yang login benar.
- **Tidak ada pesan sama sekali**: kemungkinan browser masih membuka deployment lama atau file `admin.js` terbaru belum berada di root repository. Periksa DevTools → Network dan Console.

Perbaikan frontend tidak dapat melewati kebijakan keamanan database. Jangan pernah menaruh `service_role` atau secret key di file frontend.

## Realtime

Tombol Simpan tetap dapat bekerja tanpa Realtime. Agar perubahan yang dibuat dari aplikasi lain otomatis muncul di dashboard admin, jalankan `SQL_PERBAIKAN_REALTIME.sql` pada SQL Editor Supabase project yang sama.

## Catatan file DELETE

`SQL_PERBAIKAN_HAPUS.sql` adalah contoh policy DELETE yang membatasi email `admin@gmail.com`. Jangan jalankan sebelum mengganti email itu dengan email admin yang benar dan meninjau policy yang sudah ada.
