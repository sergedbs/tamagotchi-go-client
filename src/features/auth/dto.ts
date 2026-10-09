import { z } from 'zod'

/** User Management DTOs (docs/PAYLOADS.md). */
export const tokensSchema = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(512),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
})
export type Tokens = z.output<typeof tokensSchema>

export const userSchema = z.object({
  user_id: z.string().min(1),
  username: z.string(),
  email: z.string(),
  package_ids: z.array(z.string()),
  membership_version: z.number().int(),
})
export type User = z.output<typeof userSchema>

export const registrationSchema = z.object({
  user: userSchema,
  global_currency: z.number().int(),
  starter_status: z.string(),
})
export type Registration = z.output<typeof registrationSchema>

export const packageSchema = z.object({
  package_id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  status: z.enum(['active', 'inactive']),
  config_version: z.number().int().nullable(),
  developer_user_ids: z.array(z.string()),
  moderator_user_ids: z.array(z.string()),
  revision: z.number().int(),
})
export type Package = z.output<typeof packageSchema>

export const packagePageSchema = z.object({
  items: z.array(packageSchema),
  next_cursor: z.string().nullable(),
})
export type PackagePage = z.output<typeof packagePageSchema>
