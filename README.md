# TyM Dulce — Tienda para clientes

Tienda pública independiente del sistema de punto de venta. Los clientes no crean cuentas ni inician sesión: agregan productos al carrito, dejan nombre y teléfono y reciben un ticket pendiente de validación. El acceso administrativo está discretamente integrado en el símbolo ✧ de la esquina inferior derecha.

## Componentes
- `index.html`: catálogo, carrito, datos de compra, ticket, inicio/cierre de sesión administrativo, gestión de productos/categorías y editor de contenido de portada, textos, checkout y URLs de imágenes.
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
5. La URL y la clave **publishable** que se indicaron para este proyecto ya están configuradas en `index.html`. La URL base debe ser `https://ndtpvvhhbcwosnwevikx.supabase.co` (sin `/rest/v1/`). La clave publishable es apta para frontend siempre que las políticas RLS estén correctamente aplicadas. Nunca poner la clave `service_role` ni claves `sb_secret` en HTML ni en GitHub.
6. Con Supabase CLI instalada, vincular el proyecto y desplegar la función:
   ```sh
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy create-order
   ```
   La función pública valida los datos y precios en el servidor. No requiere login del cliente; la clave de servicio solo se usa dentro del entorno de Supabase.
7. Publicar `index.html` y `logo-tym.svg` en el hosting elegido.

## Despliegue de la función de pedidos desde GitHub\n- El sitio estático se publica desde GitHub mediante Netlify, pero las Edge Functions se despliegan en Supabase por separado.\n- El workflow `.github/workflows/deploy-supabase-function.yml` permite desplegar `create-order` automáticamente cuando cambia su código y manualmente desde GitHub Actions.\n- Para activarlo, crear un token personal de Supabase y guardarlo como secreto `SUPABASE_ACCESS_TOKEN` en Settings → Secrets and variables → Actions del repositorio. Nunca pegar ese token en el código ni en el chat.\n- El proyecto Supabase configurado en el frontend tiene ref `ndtpvvhhbcwosnwevikx`; el identificador de sitio de Netlify no sustituye este project ref.\n\n## Seguridad y estado
- No hay inicio de sesión para clientes.
- Los visitantes pueden leer productos activos, pero no consultar pedidos.
- La creación de tickets solo se realiza mediante la Edge Function.
- Solo las cuentas incluidas en `admin_users` pueden editar productos, ver/actualizar pedidos o cargar imágenes.
- Los pedidos nacen como `pending_validation`; eso no significa que estén confirmados ni pagados.
- El acceso discreto no reemplaza la autenticación ni las políticas RLS.
- La página usa marcadores de posición hasta configurar el proyecto real.

## Pendiente antes de producción
- Configurar Supabase y desplegar la función.
- Configurar secretos de notificaciones y desplegar la versión actualizada de `create-order`.
- Email: crear una cuenta de Resend, verificar un dominio/remitente y configurar `RESEND_API_KEY`, `ORDER_EMAIL_TO` y `ORDER_EMAIL_FROM` como secretos de Edge Functions.
- WhatsApp: activar WhatsApp Business Platform / Cloud API, configurar `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO`, `WHATSAPP_TEMPLATE_NAME` y opcionalmente `WHATSAPP_TEMPLATE_LANGUAGE` como secretos. La plantilla aprobada debe tener seis variables de texto, en este orden: ticket, nombre del cliente, teléfono, total, resumen de productos y modalidad.
- La función registra el pedido antes de enviar avisos; si un proveedor falla, el pedido sigue guardado y el estado del aviso queda en los logs de la función.
- Probar compra de punta a punta, permisos de administrador y edición/recorte de fotos.
- Agregar medidas antispam/rate limiting al endpoint público antes de promocionar la tienda.
