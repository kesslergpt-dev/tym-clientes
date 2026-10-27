import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]!));

async function sendEmail(order: any, productsText: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ORDER_EMAIL_TO");
  const from = Deno.env.get("ORDER_EMAIL_FROM");
  if (!apiKey || !to || !from) return { status: "not_configured" };

  const html = `
    <h2>Nueva solicitud de compra · TyM Dulce</h2>
    <p><strong>Ticket:</strong> ${escapeHtml(order.ticket_code)}</p>
    <p><strong>Cliente:</strong> ${escapeHtml(order.customer_name)}</p>
    <p><strong>WhatsApp/teléfono:</strong> ${escapeHtml(order.customer_phone)}</p>
    <p><strong>Modalidad:</strong> ${escapeHtml(order.fulfillment)}</p>
    <p><strong>Fecha solicitada:</strong> ${escapeHtml(order.needed_date || "A coordinar")}</p>
    <p><strong>Productos:</strong><br>${productsText.split("\n").map(escapeHtml).join("<br>")}</p>
    <p><strong>Total calculado:</strong> ${escapeHtml(Number(order.total).toLocaleString("es-AR", { style: "currency", currency: "ARS" }))}</p>
    <p><strong>Comentarios:</strong> ${escapeHtml(order.notes || "Sin comentarios")}</p>
    <p>Estado: Pendiente de validación. Contactá al cliente para confirmar disponibilidad y condiciones.</p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to],
      subject: `Nuevo pedido ${order.ticket_code} · TyM Dulce`,
      html,
    }),
  });
  if (!response.ok) {
    console.error("Resend notification failed", response.status, await response.text());
    return { status: "failed" };
  }
  return { status: "sent" };
}

async function sendWhatsApp(order: any, productsText: string) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const to = (Deno.env.get("WHATSAPP_TO") || "").replace(/\D/g, "");
  const template = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "es_AR";
  if (!token || !phoneId || !to || !template) return { status: "not_configured" };

  // La plantilla debe estar aprobada en WhatsApp Business Platform y tener seis variables de texto.
  const total = Number(order.total).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  const productSummary = productsText.length > 900 ? productsText.slice(0, 897) + "..." : productsText;
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: String(order.ticket_code) },
            { type: "text", text: String(order.customer_name).slice(0, 100) },
            { type: "text", text: String(order.customer_phone).slice(0, 30) },
            { type: "text", text: total },
            { type: "text", text: productSummary || "Ver pedido en el panel" },
            { type: "text", text: String(order.fulfillment) },
          ],
        }],
      },
    }),
  });
  if (!response.ok) {
    console.error("WhatsApp notification failed", response.status, await response.text());
    return { status: "failed" };
  }
  return { status: "sent" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const body = await req.json();
    const customer_name = String(body.customer_name ?? "").trim();
    const customer_phone = String(body.customer_phone ?? "").trim();
    const fulfillment = ["A coordinar", "Retiro", "Entrega"].includes(body.fulfillment) ? body.fulfillment : "A coordinar";
    const notes = String(body.notes ?? "").trim();
    const needed_date = body.needed_date ? String(body.needed_date) : null;
    const submitted = body.items;
    if (customer_name.length < 2 || customer_name.length > 100) return json({ error: "Ingresá un nombre válido" }, 400);
    if (customer_phone.replace(/\D/g, "").length < 6 || customer_phone.length > 30) return json({ error: "Ingresá un teléfono válido" }, 400);
    if (notes.length > 500 || !Array.isArray(submitted) || submitted.length < 1 || submitted.length > 40) return json({ error: "El pedido no es válido" }, 400);
    if (needed_date && !/^\d{4}-\d{2}-\d{2}$/.test(needed_date)) return json({ error: "La fecha no es válida" }, 400);
    const normalized = submitted.map((x: any) => ({ product_id: String(x.product_id ?? ""), quantity: Number(x.quantity) }));
    if (normalized.some((x: any) => !/^[0-9a-f-]{36}$/i.test(x.product_id) || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 50)) return json({ error: "Hay productos o cantidades inválidas" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "La función no está configurada" }, 500);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const ids = [...new Set(normalized.map((x: any) => x.product_id))];
    const { data: products, error: productError } = await db.from("products").select("id,name,price,active").in("id", ids);
    if (productError) throw productError;
    const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));
    if (ids.some((id) => !productMap.has(id) || !(productMap.get(id) as any).active)) return json({ error: "Un producto ya no está disponible. Actualizá el catálogo." }, 409);
    const items = normalized.map((x: any) => {
      const p: any = productMap.get(x.product_id);
      return { product_id: p.id, name: p.name, quantity: x.quantity, unit_price: Number(p.price), subtotal: Number(p.price) * x.quantity };
    });
    const total = items.reduce((sum: number, x: any) => sum + x.subtotal, 0);
    const ticket_code = `TYM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: order, error } = await db.from("orders").insert({
      ticket_code, customer_name, customer_phone, fulfillment, needed_date, notes, items, total, status: "pending_validation",
    }).select("id,ticket_code,customer_name,customer_phone,fulfillment,needed_date,notes,items,total,status,created_at").single();
    if (error) throw error;

    // Las notificaciones son best-effort: un fallo de proveedor nunca descarta un pedido ya guardado.
    const productsText = items.map((x: any) => `${x.quantity} × ${x.name} — ${Number(x.subtotal).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`).join("\n");
    const [emailResult, whatsappResult] = await Promise.allSettled([
      sendEmail(order, productsText),
      sendWhatsApp(order, productsText),
    ]);
    const notifications = {
      email: emailResult.status === "fulfilled" ? emailResult.value.status : "failed",
      whatsapp: whatsappResult.status === "fulfilled" ? whatsappResult.value.status : "failed",
    };
    if (emailResult.status === "rejected") console.error("Email notification exception", emailResult.reason);
    if (whatsappResult.status === "rejected") console.error("WhatsApp notification exception", whatsappResult.reason);
    console.log("Order saved; notification statuses", { ticket_code, ...notifications });
    return json({ ...order, notifications }, 201);
  } catch (e) {
    console.error("create-order failed", e);
    return json({ error: "No pudimos registrar el pedido. Intentá nuevamente en unos minutos." }, 500);
  }
});
