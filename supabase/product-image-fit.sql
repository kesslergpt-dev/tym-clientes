-- TyM Dulce: persistir si las fotos de producto se muestran completas o recortadas.
-- Ejecutar una sola vez en Supabase SQL Editor.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover'
CHECK (image_fit IN ('cover', 'contain'));
