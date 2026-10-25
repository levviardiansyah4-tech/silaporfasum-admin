-- Jalankan setelah memastikan email admin benar dan sudah login melalui Supabase Auth.
-- Menghapus policy UPDATE luas yang membuka semua baris untuk semua authenticated.
DROP POLICY IF EXISTS "Admin dapat memperbarui laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_update_laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_update" ON public.laporan;

CREATE POLICY "silapor_admin_update"
ON public.laporan
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'admin@gmail.com');

-- Admin perlu SELECT agar .update(...).select(...) dapat mengembalikan baris.
-- Jangan menambah policy SELECT publik untuk seluruh tabel.
DROP POLICY IF EXISTS "Admin dapat membaca laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_select_laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_select" ON public.laporan;

CREATE POLICY "silapor_admin_select"
ON public.laporan
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@gmail.com');
