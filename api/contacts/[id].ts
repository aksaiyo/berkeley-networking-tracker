import type { VercelRequest, VercelResponse } from '@vercel/node'
import { contactUpdateSchema } from '../../shared/contact.js'
import { dataApiFetch, dataApiUrl, getBearerToken, handleApiError, relay, sendError } from '../_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req)
  if (!token) return sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in to manage contacts.')
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return sendError(res, 400, 'INVALID_ID', 'Invalid contact ID.')

  try {
    const url = dataApiUrl('contacts', `?id=eq.${encodeURIComponent(id)}`)
    if (req.method === 'PATCH') {
      const input = contactUpdateSchema.parse(req.body)
      const body = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]))
      return relay(await dataApiFetch(token, url, { method: 'PATCH', body: JSON.stringify(body) }), res)
    }
    if (req.method === 'DELETE') {
      return relay(await dataApiFetch(token, url, { method: 'DELETE' }), res)
    }
    res.setHeader('Allow', 'PATCH, DELETE')
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.')
  } catch (error) {
    return handleApiError(error, res)
  }
}
