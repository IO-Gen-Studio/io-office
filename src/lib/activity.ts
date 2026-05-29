import { supabase } from "@/integrations/supabase/client";

type Module = "dashboard" | "calendar" | "crm" | "outreach" | "social" | "projects" | "subscriptions" | "notifications";

export async function logActivity(args: {
  module: Module;
  entity_type: string;
  entity_id?: string | null;
  verb: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await supabase.rpc("log_activity", {
    _module: args.module,
    _entity_type: args.entity_type,
    _entity_id: args.entity_id ?? null,
    _verb: args.verb,
    _summary: args.summary,
    _metadata: (args.metadata ?? {}) as never,
  });
}
