import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  tenantId: string;
  task: string;
  comment?: string;
  priority?: string;
  sourceMeterIds?: unknown;
  sourceUserEmail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const expected = Deno.env.get("EXTERNAL_INGEST_KEY");
    const provided = req.headers.get("x-ingest-key");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const { tenantId, task, comment, priority, sourceMeterIds, sourceUserEmail } = body ?? {};

    if (!tenantId || !task) {
      return new Response(JSON.stringify({ error: "Missing tenantId or task" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: maxRow, error: maxErr } = await supabase
      .from("issues")
      .select("issue_number")
      .eq("tenant_id", tenantId)
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) throw maxErr;
    const nextNumber = (maxRow?.issue_number ?? 0) + 1;

    const metadata: Record<string, unknown> = {};
    if (sourceMeterIds !== undefined) metadata.source_meter_ids = sourceMeterIds;
    if (sourceUserEmail) metadata.source_user_email = sourceUserEmail;

    const { data: inserted, error: insErr } = await supabase
      .from("issues")
      .insert({
        tenant_id: tenantId,
        issue_number: nextNumber,
        task,
        comment: comment ?? null,
        priority: priority ?? "M",
        status: "Open",
        issue_date: new Date().toISOString().slice(0, 10),
        metadata,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, issue: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ingest-external-issue error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
