# Configuración de imágenes en GitHub para TyM Dulce

La página conserva productos, precios, pedidos y configuración en Supabase. Las nuevas fotos se guardan en el repositorio público `kesslergpt-dev/tym-dulce-assets` desde el panel de administración, mediante una función de Netlify.

## Variables de entorno en Netlify

En el sitio que publica `tym-clientes`, abrir **Site configuration → Environment variables** y agregar:

- `GITHUB_TOKEN`: token de GitHub con acceso de escritura **solo** al repositorio `kesslergpt-dev/tym-dulce-assets`. Para un fine-grained personal access token, seleccionar ese repositorio y permiso **Contents: Read and write**. No pegar este token en el HTML ni compartirlo.
- `GITHUB_ASSETS_REPO`: `kesslergpt-dev/tym-dulce-assets`
- `SUPABASE_ANON_KEY`: la clave publicable que ya usa el sitio (la que comienza con `sb_publishable_`). No usar una clave `service_role` ni una clave secreta.
- `SITE_ORIGIN`: el origen exacto del sitio publicado, copiado de la barra de direcciones y sin barra final (se permiten varios separados por comas). Configurarlo solo en las variables de entorno de Netlify; no escribir el dominio literal en este archivo.

Después de guardar las variables, ejecutar **Trigger deploy → Deploy site** para que la función las reciba.

## Cómo funciona

- Las subidas de foto principal, galería ilustrativa y carrusel del encabezado se convierten a WebP y se optimizan antes de enviarse.
- Las imágenes de productos, galerías, portada, historia y logo que aún apunten al bucket público `product-images` pueden migrarse desde Administración → Fotos.
- La función verifica la sesión de Supabase y la pertenencia a `admin_users` antes de escribir en GitHub.
- El token de GitHub permanece del lado del servidor.
- El límite de archivo optimizado para cada subida es de 3,7 MB.
- Las URLs nuevas apuntan a `raw.githubusercontent.com`; no hace falta activar GitHub Pages.
- Los archivos que ya estaban en Supabase no se borran automáticamente. Hay que migrarlos y verificar sus referencias antes de eliminar el almacenamiento antiguo.

## Verificación después del deploy

1. Ingresar al panel de administración de TyM Dulce.
2. Subir una imagen de prueba a un producto de prueba o a una foto del encabezado.
3. Confirmar que aparece un archivo nuevo dentro de `products/`, `illustrations/` o `homepage/` en `tym-dulce-assets`.
4. Confirmar que la foto se ve en la tienda y que el registro guardado tiene la URL `raw.githubusercontent.com`.
5. No eliminar archivos ni datos anteriores de Supabase hasta completar la migración y revisar el catálogo.

**Importante:** GitHub Raw sirve las imágenes públicamente, pero no es un CDN dedicado. Conviene mantener WebP comprimido y dimensiones razonables.
