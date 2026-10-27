-- TyM Dulce: migración acumulativa para pedidos, imágenes, categorías y promociones.
-- Ejecutar una sola vez en Supabase SQL Editor.

-- Permitir al administrador eliminar pedidos, respetando la política de admin existente.
GRANT DELETE ON TABLE public.orders TO authenticated;
DROP POLICY IF EXISTS "admins delete orders" ON public.orders;
CREATE POLICY "admins delete orders"
ON public.orders FOR DELETE TO authenticated
USING (public.is_tym_admin());

-- Preferencia de encuadre de la imagen principal.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover'
  CHECK (image_fit IN ('cover', 'contain'));

-- Nuevas funciones del catálogo.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS illustrative_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_promotion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS promo_note text NOT NULL DEFAULT '';

-- Mantener las categorías existentes al migrar a categorías múltiples.
UPDATE public.products
SET categories = ARRAY[category]
WHERE cardinality(categories) = 0 AND category IS NOT NULL AND category <> '';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_compare_at_price_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_compare_at_price_check
  CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
