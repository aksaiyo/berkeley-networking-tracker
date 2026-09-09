import { describe, expect, it } from 'vitest'
import { contactInputSchema, contactUpdateSchema, normalizeContactInput } from './contact'

describe('contact validation', () => {
  it('rejects an empty name', () => {
    expect(contactInputSchema.safeParse({ name: '  ', priority: 'high' }).success).toBe(false)
  })

  it('rejects an invalid priority', () => {
    expect(contactInputSchema.safeParse({ name: 'Maya', priority: 'urgent' }).success).toBe(false)
  })

  it('accepts and normalizes a valid contact', () => {
    const parsed = contactInputSchema.parse({ name: ' Maya Chen ', company: ' ', priority: 'medium' })
    expect(normalizeContactInput(parsed)).toEqual({
      name: 'Maya Chen', company: null, role: null, where_met: null, notes: null, priority: 'medium',
    })
  })

  it('requires at least one update field', () => {
    expect(contactUpdateSchema.safeParse({}).success).toBe(false)
  })
})
