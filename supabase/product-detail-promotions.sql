-- TyM Dulce: categorías múltiples, promociones y galería de producto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS illustrative_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_promotion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS promo_note text NOT NULL DEFAULT '';

-- Conserva la categoría principal que ya existe y la incorpora a la lista múltiple.
UPDATE public.products
SET categories = ARRAY[category]
WHERE cardinality(categories) = 0 AND category IS NOT NULL AND category <> '';

-- Validación: el precio comparativo, si se informa, debe ser positivo o cero.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_compare_at_price_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_compare_at_price_check
  CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
