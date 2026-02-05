import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "At least 6 characters"),
  agreedToTerms: z.boolean().refine((v) => v, "You must agree to the terms"),
});

export type SignupFormData = z.infer<typeof signupSchema>;
