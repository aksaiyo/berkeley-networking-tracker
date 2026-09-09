import { z } from 'zod'

export const priorities = ['high', 'medium', 'low'] as const
export type Priority = (typeof priorities)[number]

const optionalText = z.union([z.string().trim().max(2000), z.null()]).optional()

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer'),
  company: optionalText,
  role: optionalText,
  where_met: optionalText,
  notes: optionalText,
  priority: z.enum(priorities, { message: 'Priority must be high, medium, or low' }),
}).strict()

export const contactUpdateSchema = contactInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
)

export type ContactInput = z.infer<typeof contactInputSchema>

export interface Contact extends ContactInput {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export function normalizeContactInput(input: ContactInput): ContactInput {
  return {
    ...input,
    name: input.name.trim(),
    company: input.company?.trim() || null,
    role: input.role?.trim() || null,
    where_met: input.where_met?.trim() || null,
    notes: input.notes?.trim() || null,
  }
}
