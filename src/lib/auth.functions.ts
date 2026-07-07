import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Look up the email address tied to an employee code so users can sign in
 * using their AS Construction code instead of their email.
 *
 * Runs unauthenticated (the login form calls it before sign-in).
 * Uses the service role to read a single email column from profiles.
 */
export const resolveEmployeeEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        employeeCode: z
          .string()
          .min(3)
          .max(64)
          .regex(/^[A-Za-z0-9_-]+$/, "Invalid employee code"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("email,is_active,is_archived")
      .ilike("employee_code", data.employeeCode)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row || !row.is_active || row.is_archived) {
      throw new Error("Invalid employee code or password");
    }
    return { email: row.email as string };
  });
