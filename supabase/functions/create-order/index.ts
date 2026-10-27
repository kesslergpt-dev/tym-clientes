import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"Método no permitido"},405);
 try {
  const body=await req.json();
  const customer_name=String(body.customer_name??"").trim();
  const customer_phone=String(body.customer_phone??"").trim();
  const fulfillment=["A coordinar","Retiro","Entrega"].includes(body.fulfillment)?body.fulfillment:"A coordinar";
  const notes=String(body.notes??"").trim();
  const needed_date=body.needed_date?String(body.needed_date):null;
  const submitted=body.items;
  if(customer_name.length<2||customer_name.length>100) return json({error:"Ingresá un nombre válido"},400);
  if(customer_phone.replace(/\D/g,"").length<6||customer_phone.length>30) return json({error:"Ingresá un teléfono válido"},400);
  if(notes.length>500||!Array.isArray(submitted)||submitted.length<1||submitted.length>40) return json({error:"El pedido no es válido"},400);
  if(needed_date&&!/^\d{4}-\d{2}-\d{2}$/.test(needed_date)) return json({error:"La fecha no es válida"},400);
  const normalized=submitted.map((x:any)=>({product_id:String(x.product_id??""),quantity:Number(x.quantity)}));
  if(normalized.some((x:any)=>!/^[0-9a-f-]{36}$/i.test(x.product_id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>50)) return json({error:"Hay productos o cantidades inválidas"},400);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return json({error:"La función no está configurada"},500);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const ids=[...new Set(normalized.map((x:any)=>x.product_id))];
  const {data:products,error:productError}=await db.from("products").select("id,name,price,active").in("id",ids);
  if(productError) throw productError;
  const map=new Map((products??[]).map((p:any)=>[p.id,p]));
  if(ids.some(id=>!map.has(id)||!map.get(id).active)) return json({error:"Un producto ya no está disponible. Actualizá el catálogo."},409);
  const items=normalized.map((x:any)=>{const p:any=map.get(x.product_id);return {product_id:p.id,name:p.name,quantity:x.quantity,unit_price:Number(p.price),subtotal:Number(p.price)*x.quantity};});
  const total=items.reduce((sum:number,x:any)=>sum+x.subtotal,0);
  const ticket_code=`TYM-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const {data,error}=await db.from("orders").insert({ticket_code,customer_name,customer_phone,fulfillment,needed_date,notes,items,total,status:"pending_validation"}).select("id,ticket_code,customer_name,customer_phone,fulfillment,needed_date,notes,items,total,status,created_at").single();
  if(error) throw error;
  return json(data,201);
 } catch(e) {
  console.error("create-order failed",e);
  return json({error:"No pudimos registrar el pedido. Intentá nuevamente en unos minutos."},500);
 }
});