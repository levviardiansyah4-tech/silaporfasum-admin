-- SiLaporFasum: policy hapus laporan khusus admin.
-- Jalankan pada project Supabase yang sama dengan website admin.
-- Ganti admin@gmail.com jika email login admin yang sebenarnya berbeda.

ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "silapor_admin_delete_laporan" ON public.laporan;
CREATE POLICY "silapor_admin_delete_laporan"
ON public.laporan
FOR DELETE
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com'
);

-- Supabase perlu SELECT untuk mengembalikan .select("id") setelah DELETE.
DROP POLICY IF EXISTS "silapor_admin_select_for_delete_confirmation" ON public.laporan;
CREATE POLICY "silapor_admin_select_for_delete_confirmation"
ON public.laporan
FOR SELECT
TO authenticated
USING (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com'
);

-- Catatan: policy permissive SELECT lain yang sudah ada tetap berlaku (policy digabung OR).
-- Jangan membuat policy DELETE untuk anon/public.
