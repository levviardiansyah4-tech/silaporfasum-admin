# SiLaporFasum Admin

Paket ini disusun agar file situs berada langsung di root repository GitHub Pages.

## Pasang di GitHub Pages
1. Buka repository GitHub yang dipakai untuk situs admin.
2. Masuk tab **Code**.
3. Pastikan `index.html` terlihat langsung di daftar file utama (bukan di dalam folder tambahan).
4. Unggah/ganti file dari ZIP ini langsung ke root repository: `index.html`, `admin.css`, `admin-petugas.css`, dan `admin.js`.
5. Commit perubahan ke branch `main`.
6. Di Settings → Pages, gunakan **Deploy from a branch**, branch `main`, folder `/(root)`.
7. Tunggu deployment selesai lalu buka URL yang ditampilkan GitHub Pages. Jika nama repository masih `silaporfasum-admin.` (titik di akhir), sebaiknya ubah namanya menjadi `silaporfasum-admin` pada Settings → General lalu gunakan URL baru yang Pages tampilkan.
8. Hard refresh: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac).

## Konfigurasi Supabase
URL dan publishable key berada di bagian atas `admin.js`. Jangan masukkan `service_role` atau secret key ke website.

## Fitur
Login Supabase Auth, dashboard laporan, pencarian/filter, detail laporan, update status, penugasan petugas, daftar petugas, foto laporan, dan pembaruan otomatis daftar/dashboard saat ada perubahan laporan di database.

## Aktifkan pembaruan otomatis (Realtime)
1. Buka **Supabase → SQL Editor** pada project yang sama.
2. Buka file `SQL_PERBAIKAN_REALTIME.sql`, salin isinya, lalu jalankan.
3. Pastikan akun admin memiliki izin `SELECT` dan `UPDATE` melalui Row Level Security (RLS) pada tabel `public.laporan`.
4. Setelah file website diperbarui di GitHub Pages, lakukan hard refresh (`Ctrl+Shift+R`).

Jika Realtime belum diaktifkan, tombol **Simpan Perubahan** tetap akan menyimpan perubahan dan memperbarui tampilan setelah database mengonfirmasi; pembaruan otomatis dari kiriman/perubahan lain membutuhkan Realtime aktif.

## Jika fitur database gagal
File frontend tidak dapat melewati Row Level Security (RLS). Pastikan akun login mempunyai policy yang sesuai untuk SELECT/UPDATE/INSERT pada tabel `public.laporan` dan `public.petugas`, serta policy Storage untuk membaca foto. Periksa Console/Network browser untuk pesan error yang spesifik.

`SQL_PERBAIKAN_HAPUS.sql` adalah contoh policy DELETE yang membatasi akses pada email `admin@gmail.com`. Jangan jalankan sebelum mengganti email tersebut menjadi email admin yang benar dan meninjau policy yang sudah ada di project Anda.
