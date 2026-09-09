import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ZodError } from 'zod'

export function sendError(res: VercelResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } })
}

export function getBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization
  return value?.startsWith('Bearer ') ? value.slice(7) : null
}

export function dataApiUrl(path: string, query = ''): string {
  const base = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.replace(/\/$/, '')
  if (!base) throw new Error('NEXT_PUBLIC_NEON_DATA_API_URL is not configured')
  return `${base}/${path}${query}`
}

export async function dataApiFetch(token: string, url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  })
}

export async function relay(response: Response, res: VercelResponse, successStatus = response.status) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = response.status === 401 ? 'Please sign in again.'
      : response.status === 403 ? 'You do not have permission to access this contact.'
      : 'The contact service could not complete that request.'
    return sendError(res, response.status, 'DATA_API_ERROR', message)
  }
  return res.status(successStatus).json(body)
}

export function handleApiError(error: unknown, res: VercelResponse) {
  if (error instanceof ZodError) {
    return sendError(res, 400, 'VALIDATION_ERROR', error.issues[0]?.message ?? 'Invalid contact data')
  }
  console.error(error)
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
}
