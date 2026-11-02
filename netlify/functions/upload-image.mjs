import { randomUUID } from "node:crypto";

const SUPABASE_URL = "https://ndtpvvhhbcwosnwevikx.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ASSETS_REPO = process.env.GITHUB_ASSETS_REPO || "kesslergpt-dev/tym-dulce-assets";
const ALLOWED_ORIGINS = (process.env.SITE_ORIGIN || "https://tymdulce.netlify.app").split(",").map(s => s.trim()).filter(Boolean);
const MAX_BYTES = 3_700_000;

let requestOrigin = "https://tymdulce.netlify.app";
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": requestOrigin,
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return response(204, {});
  if (event.httpMethod !== "POST") return response(405, { error: "Método no permitido." });
  if (!SUPABASE_ANON_KEY || !GITHUB_TOKEN) {
    return response(503, { error: "Falta configurar GITHUB_TOKEN y SUPABASE_ANON_KEY en las variables de Netlify." });
  }

  const origin = event.headers.origin || event.headers.Origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return response(403, { error: "Origen no autorizado." });

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return response(401, { error: "Iniciá sesión como administradora o administrador." });

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` }
    });
    if (!userRes.ok) return response(401, { error: "La sesión expiró. Volvé a ingresar al panel." });
    const authUser = await userRes.json();

    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(authUser.id)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } }
    );
    if (!adminRes.ok) return response(403, { error: "No se pudo verificar el permiso administrativo." });
    const admins = await adminRes.json();
    if (!Array.isArray(admins) || admins.length === 0) return response(403, { error: "Se requieren permisos administrativos." });

    const input = JSON.parse(event.body || "{}");
    const allowedFolders = new Set(["products", "illustrations", "homepage"]);
    const folder = String(input.folder || "");
    const contentType = String(input.contentType || "");
    const base64 = String(input.base64 || "");
    if (!allowedFolders.has(folder)) return response(400, { error: "Carpeta de destino no válida." });
    if (contentType !== "image/webp") return response(415, { error: "Las imágenes deben estar optimizadas en formato WebP." });
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return response(400, { error: "Archivo de imagen no válido." });

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) return response(413, { error: "La imagen supera el límite de 3,7 MB. Probá con una imagen más liviana." });

    const path = `${folder}/${randomUUID()}.webp`;
    const ghRes = await fetch(`https://api.github.com/repos/${ASSETS_REPO}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Agregar imagen ${folder}/${path.split("/").pop()}`,
        content: bytes.toString("base64"),
        branch: "main"
      })
    });
    const ghData = await ghRes.json().catch(() => ({}));
    if (!ghRes.ok) {
      console.error("GitHub upload failed", ghRes.status, ghData.message);
      const msg = ghRes.status === 401 || ghRes.status === 403
        ? "GitHub rechazó el token. Revisá sus permisos de escritura sobre tym-dulce-assets."
        : "GitHub no pudo guardar la imagen. Revisá la configuración e intentá otra vez.";
      return response(502, { error: msg });
    }

    return response(200, {
      path: `github:${path}`,
      url: `https://raw.githubusercontent.com/${ASSETS_REPO}/main/${path}`
    });
  } catch (error) {
    console.error("Image upload error", error);
    return response(400, { error: "No se pudo procesar la imagen. Revisá el archivo e intentá otra vez." });
  }
}
