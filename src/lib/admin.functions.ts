import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    full_name: z.string().min(1).max(120),
    job_title: z.string().max(120).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        job_title: data.job_title,
        must_change_password: true,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // Trigger may have created profile; ensure fields are set:
    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name, job_title: data.job_title, must_change_password: true,
    }).eq("id", uid);
    return { user_id: uid };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    password: z.string().min(8).max(128),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.user_id);
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    full_name: z.string().min(1).max(120),
    job_title: z.string().max(120).nullable(),
    active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({
      full_name: data.full_name, job_title: data.job_title, active: data.active,
    }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    is_admin: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.is_admin) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.user_id, role: "admin" },
        { onConflict: "user_id,role" },
      );
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
    }
    return { ok: true };
  });

const MODULES = ["dashboard","calendar","crm","outreach","social","projects","subscriptions","settings"] as const;

export const adminSetModuleAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    entries: z.array(z.object({
      module: z.enum(MODULES),
      can_view: z.boolean(),
      can_edit: z.boolean(),
    })).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("module_access").delete().eq("user_id", data.user_id);
    const rows = data.entries
      .filter((e) => e.can_view || e.can_edit)
      .map((e) => ({ user_id: data.user_id, module: e.module, can_view: e.can_view || e.can_edit, can_edit: e.can_edit }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("module_access").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [{ data: profiles }, { data: roles }, { data: access }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("module_access").select("*"),
    ]);
    return { profiles: profiles ?? [], roles: roles ?? [], access: access ?? [] };
  });
