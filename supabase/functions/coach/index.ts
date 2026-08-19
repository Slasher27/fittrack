// FitTrack — Coach proxy (Supabase Edge Function, Deno).
// The ONLY server-side code in the app: it holds the Anthropic key so users never do,
// checks the caller is a signed-in FitTrack user, applies a per-user daily quota, and
// forwards one Messages request to Claude. The agent loop (tools, previews, confirms)
// runs in the client because every write touches the user's local IndexedDB.
//
// Deploy:  supabase functions deploy coach --no-verify-jwt   (we verify the JWT ourselves so
//          we can return a clean 401 with CORS headers)
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-…   (SUPABASE_URL / SUPABASE_ANON_KEY /
//          SUPABASE_SERVICE_ROLE_KEY are injected automatically)
// Quota:   COACH_DAILY_LIMIT (default 60 requests / user / day) — see supabase-schema.sql (ai_usage).
import Anthropic from "npm:@anthropic-ai/sdk@0.110.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { error: "Coach is not configured on the server (ANTHROPIC_API_KEY secret missing)" });

  // 1. Who is calling? The app sends its Supabase session token.
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "Sign in to use the coach" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Supabase is moving from SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY to JSON dictionaries
  // (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS); accept either generation.
  const firstOf = (json?: string) => { try { const o = JSON.parse(json || "{}"); const v = Object.values(o)[0]; return typeof v === "string" ? v : (v as any)?.key || ""; } catch { return ""; } };
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || firstOf(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || firstOf(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: uerr } = await userClient.auth.getUser();
  if (uerr || !user) return json(401, { error: "Session expired — sign in again" });

  // 2. Quota (service role bypasses RLS on ai_usage).
  const limit = Number(Deno.env.get("COACH_DAILY_LIMIT") || 60);
  const admin = createClient(supabaseUrl, serviceKey || anonKey);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("*", { count: "exact", head: true })
    .eq("user_id", user.id).gte("at", since);
  if ((count || 0) >= limit) return json(429, { error: `Daily coach limit reached (${limit}). Try again tomorrow.` });

  // 3. Forward exactly one Messages request. The client owns system/messages/tools;
  //    the server pins model, thinking, output size and the safety fallback.
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Bad JSON" }); }
  if (!Array.isArray(body?.messages) || !body.messages.length) return json(400, { error: "messages required" });
  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: Math.min(Number(body.max_tokens) || 4000, 8000),
      thinking: { type: "adaptive" },
      output_config: { effort: body.effort === "high" ? "high" : "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: body.system,
      messages: body.messages,
      tools: body.tools,
      tool_choice: body.tool_choice,
    } as any);
    // 4. Record usage (fire and forget).
    admin.from("ai_usage").insert({
      user_id: user.id, model: res.model, kind: body.kind || "chat",
      input_tokens: res.usage?.input_tokens ?? 0, output_tokens: res.usage?.output_tokens ?? 0,
      cache_read: (res.usage as any)?.cache_read_input_tokens ?? 0,
    }).then(() => {}, () => {});
    return json(200, { content: res.content, stop_reason: res.stop_reason, stop_details: (res as any).stop_details ?? null, usage: res.usage, model: res.model });
  } catch (e) {
    const status = (e as any)?.status ?? 502;
    const msg = (e as any)?.message || "Coach request failed";
    return json(status >= 400 && status < 600 ? status : 502, { error: msg });
  }
});
