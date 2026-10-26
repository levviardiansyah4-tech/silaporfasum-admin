-- SiLaporFasum v14: update status admin melalui RPC yang tervalidasi.
-- Proyek Supabase: ytasgufassdscmxnjeyr
-- Akun admin yang diizinkan: admin@gmail.com
-- Jalankan di Supabase SQL Editor SEBELUM deploy kode admin v14.

BEGIN;

-- Hapus policy UPDATE yang terlalu luas yang pernah terlihat pada audit.
DROP POLICY IF EXISTS "silapor_admin_update_laporan" ON public.laporan;
DROP POLICY IF EXISTS "Admin dapat memperbarui laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_update" ON public.laporan;

CREATE POLICY "silapor_admin_update"
ON public.laporan
FOR UPDATE
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com');

-- Pastikan SELECT admin tetap diizinkan untuk memuat daftar laporan.
DROP POLICY IF EXISTS "silapor_admin_select_laporan" ON public.laporan;
DROP POLICY IF EXISTS "silapor_admin_select" ON public.laporan;
DROP POLICY IF EXISTS "Admin dapat membaca laporan" ON public.laporan;

CREATE POLICY "silapor_admin_select"
ON public.laporan
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@gmail.com');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.laporan TO authenticated;

-- SECURITY DEFINER menjalankan update sebagai pemilik fungsi (postgres),
-- sehingga RLS tidak menggagalkan update status. Fungsi tetap memverifikasi
-- bahwa pemanggil adalah akun admin yang diizinkan.
CREATE OR REPLACE FUNCTION public.silapor_admin_update_status_v14(
  p_id text,
  p_status text
)
RETURNS TABLE (id text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rows integer;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login admin diperlukan.' USING ERRCODE = '42501';
  END IF;

  IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'admin@gmail.com' THEN
    RAISE EXCEPTION 'Akun % tidak diizinkan mengubah status laporan.',
      coalesce(auth.jwt() ->> 'email', '(email kosong)')
      USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL OR btrim(p_id) = '' THEN
    RAISE EXCEPTION 'ID laporan wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN (
    'Laporan Dikirim',
    'Diverifikasi',
    'Sedang Diproses',
    'Selesai Diperbaiki'
  ) THEN
    RAISE EXCEPTION 'Status laporan tidak valid: %', p_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.laporan AS l
  SET status = p_status
  WHERE l.id = p_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Laporan dengan ID % tidak ditemukan.', p_id USING ERRCODE = 'P0002';
  END IF;

  -- Baca ulang nilai aktual setelah update/trigger selesai.
  SELECT l.status INTO v_status
  FROM public.laporan AS l
  WHERE l.id = p_id;

  IF v_status IS DISTINCT FROM p_status THEN
    RAISE EXCEPTION 'Status laporan % tidak bertahan setelah update. Status database: %, status pilihan: %.',
      p_id, v_status, p_status USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT l.id, l.status
  FROM public.laporan AS l
  WHERE l.id = p_id;
END;
$function$;

ALTER FUNCTION public.silapor_admin_update_status_v14(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.silapor_admin_update_status_v14(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.silapor_admin_update_status_v14(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.silapor_admin_update_status_v14(text, text) TO authenticated;

COMMIT;

-- Setelah menjalankan SQL, deploy index.html dan admin.js versi v14.
-- Fungsi ini hanya mengubah kolom status. Penugasan/tanggal tetap diproses
-- terpisah oleh admin.js agar kegagalannya tidak membatalkan status.
