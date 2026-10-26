-- SiLaporFasum Admin v13 — izin eksplisit untuk menyimpan status laporan.
-- Jalankan di Supabase SQL Editor pada project ytasgufassdscmxnjeyr.
-- Admin login yang diizinkan: admin@gmail.com
--
-- Script ini:
-- 1) memastikan role authenticated mendapat privilege tabel yang dibutuhkan,
-- 2) menghapus policy UPDATE terlalu luas yang memakai USING(true)/WITH CHECK(true),
-- 3) memastikan policy SELECT dan UPDATE admin dibatasi ke email admin@gmail.com,
-- 4) tidak membuka SELECT tabel laporan kepada anon/public.

BEGIN;

ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.laporan TO authenticated;

-- Hapus policy UPDATE umum/terlalu luas yang pernah muncul pada audit.
DROP POLICY IF EXISTS "silapor_admin_update_laporan" ON public.laporan;
DROP POLICY IF EXISTS "Admin dapat memperbarui laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_update" ON public.laporan;

-- Buat kembali policy UPDATE khusus admin.
CREATE POLICY "silapor_admin_update"
ON public.laporan
FOR UPDATE
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('admin@gmail.com')
)
WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('admin@gmail.com')
);

-- Pastikan policy SELECT admin ada agar aplikasi dapat membaca ulang status.
DROP POLICY IF EXISTS "silapor_admin_select_laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_select" ON public.laporan;
DROP POLICY IF EXISTS "Admin dapat membaca laporan" ON public.laporan;

CREATE POLICY "silapor_admin_select"
ON public.laporan
FOR SELECT
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('admin@gmail.com')
);

COMMIT;

-- Setelah menjalankan:
-- 1) deploy admin.js dan index.html dari paket v13,
-- 2) logout lalu login kembali dengan admin@gmail.com,
-- 3) buka detail laporan, pilih Diverifikasi atau Sedang Diproses, klik Simpan,
-- 4) jika gagal, catat pesan error lengkap dari toast dan Console browser.
