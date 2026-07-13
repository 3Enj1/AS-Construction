import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const employeeCodeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(3, "Employee code is required")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid employee code"),
});

export const resolveEmployeeEmail = createServerFn({
  method: "POST",
})
  .validator(employeeCodeSchema)
  .handler(async ({ data }) => {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("email, is_active, is_archived")
        .ilike("employee_code", data.employeeCode)
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
