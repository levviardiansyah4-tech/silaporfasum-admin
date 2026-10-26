-- SiLaporFasum: izin SELECT dan UPDATE laporan untuk akun admin saja.
-- LANGKAH WAJIB: ganti EMAIL_ADMIN_ANDA@example.com dengan email PERSIS yang
-- digunakan untuk login di aplikasi admin, lalu jalankan di Supabase SQL Editor.
-- Project yang benar: ytasgufassdscmxnjeyr
-- Jangan menaruh service_role/secret key di frontend.

ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON TABLE public.laporan TO authenticated;

DROP POLICY IF EXISTS "silapor_admin_select_laporan" ON public.laporan;
CREATE POLICY "silapor_admin_select_laporan"
ON public.laporan
FOR SELECT
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('EMAIL_ADMIN_ANDA@example.com')
);

DROP POLICY IF EXISTS "silapor_admin_update_laporan" ON public.laporan;
CREATE POLICY "silapor_admin_update_laporan"
ON public.laporan
FOR UPDATE
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('EMAIL_ADMIN_ANDA@example.com')
)
WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'email', '')) = lower('EMAIL_ADMIN_ANDA@example.com')
);

-- Catatan:
-- 1. Policy permissive yang sudah ada tetap dapat berlaku (digabung dengan OR).
-- 2. Script ini tidak membuat policy untuk anon/public.
-- 3. Jika policy UPDATE sudah ada, periksa juga policy lain dan email login.
