import { z } from "zod";

export const createInviteFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address"),
  role: z.enum(["admin", "user"]),
});

export const acceptInviteFormSchema = z
  .object({
    token: z.string().trim().min(1, "Invite token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type CreateInviteFormSchemaType = z.infer<typeof createInviteFormSchema>;
export type AcceptInviteFormSchemaType = z.infer<typeof acceptInviteFormSchema>;
