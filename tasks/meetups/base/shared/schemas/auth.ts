import { z } from "zod"

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export const signUpSchema = z.object({
  name: z.string("Enter your name").trim().min(1, "Enter your name").max(80, "Keep your name to 80 characters or fewer"),
  email: z.email("Enter your email"),
  password: z.string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Keep your password to ${PASSWORD_MAX} characters or fewer`),
})

export const signInSchema = z.object({
  email: z.email("Enter your email"),
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, `Keep your password to ${PASSWORD_MAX} characters or fewer`),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Enter your email"),
})

export const resetPasswordSchema = z.object({
  password: signUpSchema.shape.password,
})
