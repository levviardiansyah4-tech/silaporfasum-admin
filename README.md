# SiLaporFasum Admin — Versi Tampilan Dashboard Baru

Paket ini berisi pembaruan tampilan admin dengan fokus pada UI/UX:
- desain dashboard lebih modern,
- tambahan diagram/visual data pada dashboard dan halaman laporan,
- ringkasan statistik petugas,
- **tanpa mengubah alur fitur utama** seperti login, memuat data, filter, detail laporan, penugasan petugas, dan update status.

## File yang diubah
- `index.html`
- `admin.css`
- `admin.js`

## File yang dipertahankan
- `admin-petugas.css`
- `supabase-config.js`

## Fitur yang tetap sama
- Login admin Supabase
- Muat data laporan dan petugas
- Filter dan pencarian laporan
- Detail laporan + ubah status + penugasan petugas
- Tambah/edit petugas
- Toast notifikasi

## Catatan
Diagram dibuat dengan HTML/CSS/JS murni, tanpa library eksternal, sehingga lebih ringan dan tidak mengubah mekanisme data yang sudah berjalan.


## Perbaikan status dan foto (diagnostik)

- Simpan status sekarang memeriksa baris yang dikembalikan Supabase; jika nol baris atau ditolak RLS, pesan kesalahan ditampilkan.
- Setelah simpan, data laporan dimuat ulang dari Supabase.
- Resolver foto menerima URL penuh atau path relatif dalam bucket `foto-laporan`.

Penting: kode frontend tidak dapat melewati Row Level Security. Jika muncul error permission/RLS, atur policy UPDATE secara aman untuk akun admin di Supabase. Jangan gunakan service-role key di browser.
\n\nPerbaikan status: handler submit menahan navigasi GET, update memverifikasi hasil di Supabase, dan menampilkan error RLS secara jelas. Jalankan PERBAIKAN-RLS-ADMIN.sql hanya setelah memastikan admin memakai email admin@gmail.com. Foto: URL pada database dipakai apa adanya jika berupa URL penuh; jika masih 404 Bucket not found, bucket name/project URL di Supabase harus dicocokkan karena JavaScript tidak bisa memperbaiki bucket yang tidak ditemukan.\n