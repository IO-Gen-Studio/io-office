import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Module = Database["public"]["Enums"]["app_module"];

export async function logActivity(args: {
  module: Module;
  entity_type: string;
  entity_id?: string;
  verb: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await supabase.rpc("log_activity", {
    _module: args.module,
    _entity_type: args.entity_type,
    ...(args.entity_id ? { _entity_id: args.entity_id } : {}),
    _verb: args.verb,
    _summary: args.summary,
    _metadata: (args.metadata ?? {}) as never,
  } as never);
}
