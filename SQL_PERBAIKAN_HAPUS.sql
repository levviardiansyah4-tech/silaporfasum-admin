-- Perbaikan fitur Hapus laporan SiLaporFasum
-- Jalankan di Supabase Dashboard > SQL Editor.
-- Policy ini hanya mengizinkan akun admin@gmail.com yang sudah login.
-- Jika email admin berbeda, ganti alamat pada policy dengan email admin yang benar.

ALTER TABLE public.laporan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "silapor_admin_delete_laporan" ON public.laporan;
CREATE POLICY "silapor_admin_delete_laporan"
ON public.laporan
FOR DELETE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com');

-- Catatan: supaya aplikasi bisa mengonfirmasi baris yang terhapus, akun admin
-- juga harus memiliki policy SELECT yang mengizinkan membaca baris laporan.
-- Jangan gunakan policy DELETE untuk anon/public.
