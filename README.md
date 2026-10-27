# TyM Dulce — Tienda para clientes

Tienda pública independiente del sistema de punto de venta. Los clientes no crean cuentas ni inician sesión: agregan productos al carrito, dejan nombre y teléfono y reciben un ticket pendiente de validación. El acceso administrativo está discretamente integrado en el símbolo ✧ de la esquina inferior derecha.

## Componentes
- `index.html`: catálogo, carrito, datos de compra, ticket, inicio/cierre de sesión administrativo y editor de productos con recorte de imágenes.
- `supabase/schema.sql`: tablas, políticas RLS y bucket de imágenes.
- `supabase/functions/create-order/`: crea tickets pendientes y recalcula los precios desde la base de datos; no confía en los precios enviados por el navegador.
- `supabase/config.toml`: permite checkout sin cuenta de cliente.

## Configurar Supabase
1. Crear un proyecto Supabase dedicado a la tienda TyM Dulce. No reutilizar el proyecto del punto de venta.
2. En SQL Editor, ejecutar una sola vez `supabase/schema.sql`.
3. En Supabase Authentication, crear la cuenta del administrador. No habilitar registro público.
4. Copiar el UUID del usuario y ejecutar en SQL Editor, reemplazando el valor:
   ```sql
   insert into public.admin_users(user_id) values ('UUID-DEL-ADMINISTRADOR');
   ```
5. En `index.html`, reemplazar `SUPABASE_URL` y `SUPABASE_ANON_KEY` con la URL y la clave **publishable/anon** del proyecto nuevo. Nunca poner la clave `service_role` en HTML ni compartirla.
6. Con Supabase CLI instalada, vincular el proyecto y desplegar la función:
   ```sh
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy create-order
   ```
   La función pública valida los datos y precios en el servidor. No requiere login del cliente; la clave de servicio solo se usa dentro del entorno de Supabase.
7. Publicar `index.html` y `logo-tym.svg` en el hosting elegido.

## Seguridad y estado
- No hay inicio de sesión para clientes.
- Los visitantes pueden leer productos activos, pero no consultar pedidos.
- La creación de tickets solo se realiza mediante la Edge Function.
- Solo las cuentas incluidas en `admin_users` pueden editar productos, ver/actualizar pedidos o cargar imágenes.
- Los pedidos nacen como `pending_validation`; eso no significa que estén confirmados ni pagados.
- El acceso discreto no reemplaza la autenticación ni las políticas RLS.
- La página usa marcadores de posición hasta configurar el proyecto real.

## Pendiente antes de producción
- Configurar Supabase y desplegar la función.
- Elegir cómo querés recibir avisos de pedidos (email o WhatsApp). Por ahora, los tickets aparecerán en el panel de administración; todavía no hay notificaciones externas.
- Probar compra de punta a punta, permisos de administrador y edición/recorte de fotos.
- Agregar medidas antispam/rate limiting al endpoint público antes de promocionar la tienda.
