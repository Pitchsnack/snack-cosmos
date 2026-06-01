import { z } from "zod";

/**
 * Application-wide password policy.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - Special characters allowed but not required
 */
export const PASSWORD_POLICY_TEXT =
  "Min 8 characters, with an uppercase letter, a lowercase letter, and a number.";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");
