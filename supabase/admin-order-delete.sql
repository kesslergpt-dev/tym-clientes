-- TyM Dulce: permitir que administradores eliminen pedidos desde el panel.
-- Ejecutar una sola vez en Supabase SQL Editor.
GRANT DELETE ON TABLE public.orders TO authenticated;

DROP POLICY IF EXISTS "admins delete orders" ON public.orders;
CREATE POLICY "admins delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_tym_admin());
