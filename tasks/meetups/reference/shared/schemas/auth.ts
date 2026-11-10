import { z } from "zod"

/** Better Auth's own limits, set explicitly in server/auth.ts so the form and the server can't drift apart. */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

/** One schema for the sign-up form and for the server, which runs it before Better Auth creates the user. */
export const signUpSchema = z.object({
  name: z.string("Enter your name").trim().min(1, "Enter your name").max(80, "Keep your name to 80 characters or fewer"),
  email: z.email("Enter your email"),
  password: z.string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Keep your password to ${PASSWORD_MAX} characters or fewer`),
})

export const signInSchema = z.object({
  email: z.email("Enter your email"),
  // Better Auth refuses passwords over the maximum at sign-in too, so the form says so first.
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, `Keep your password to ${PASSWORD_MAX} characters or fewer`),
})
