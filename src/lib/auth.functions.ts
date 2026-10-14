import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeCodeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(3, "Employee code is required")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid employee code"),
});

/** ILIKE treats `%`/`_`/`\` as pattern wildcards — escape them so a login
 * attempt is always matched as a literal (case-insensitive) string, never a
 * wildcard pattern. The employee-code regex above only allows `_` through
 * today, but this stays correct even if that validator ever changes. */
function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export const resolveEmployeeEmail = createServerFn({
  method: "POST",
})
  .validator(employeeCodeSchema)
  .handler(async ({ data }) => {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("email, is_active, is_archived")
        .ilike("employee_code", escapeIlikePattern(data.employeeCode))
        .maybeSingle();

      if (error) {
        console.error("Supabase query error:", error);
        throw new Error("Unable to verify employee account.");
      }

      if (!profile) {
        throw new Error("Invalid employee code or password.");
      }

      if (!profile.is_active || profile.is_archived) {
        throw new Error("Your account has been disabled.");
      }

      return {
        email: profile.email,
      };
    } catch (err) {
      console.error("resolveEmployeeEmail failed:", err);
      throw err;
    }
  });

const APP_ROLES = [
  "admin",
  "project_manager",
  "site_supervisor",
  "worker",
  "subcontractor",
  "client",
] as const;

const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  employeeCode: z
    .string()
    .trim()
    .min(3, "Employee code is required")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid employee code"),
  email: z.string().trim().email("Invalid email"),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(APP_ROLES),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Admin-only: creates a real Supabase Auth user + profile + role for a new employee. */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(createEmployeeSchema)
  .handler(async ({ data, context }) => {
    const { data: callerRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) {
      throw new Error("Only admins can add users.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        role: data.role,
        employee_code: data.employeeCode,
        full_name: data.fullName,
        phone: data.phone || undefined,
      },
    });
    if (error) throw new Error(error.message);

    return { id: created.user?.id ?? null };
  });

const setEmployeeRemovedSchema = z.object({
  profileId: z.string().uuid(),
  removed: z.boolean(),
});

/** Admin-only: remove (or restore) a user. Removing deactivates their profile
 * (so the employee-code login refuses them and they drop out of pickers) and
 * bans their Supabase Auth user (so existing sessions can't refresh). Nothing
 * is deleted — their tasks, diary entries, chat and clock-ins stay intact. */
export const setEmployeeRemoved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setEmployeeRemovedSchema)
  .handler(async ({ data, context }) => {
    const { data: callerRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) {
      throw new Error("Only admins can remove users.");
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id,auth_user_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (!target) throw new Error("User not found.");
    if (target.auth_user_id === context.userId) {
      throw new Error("You can't remove your own login.");
    }

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: data.removed ? "876000h" : "none",
    });
    if (banError) throw new Error(banError.message);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(
        data.removed
          ? {
              is_active: false,
              is_archived: true,
              archived_at: new Date().toISOString(),
              archived_by: me?.id ?? null,
              archive_reason: "Removed by admin",
            }
          : {
              is_active: true,
              is_archived: false,
              archived_at: null,
              archived_by: null,
              archive_reason: null,
            },
      )
      .eq("id", target.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
