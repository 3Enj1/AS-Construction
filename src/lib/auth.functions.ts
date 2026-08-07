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
