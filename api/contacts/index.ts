import type { VercelRequest, VercelResponse } from '@vercel/node'
import { contactInputSchema, normalizeContactInput, priorities } from '../../shared/contact.js'
import { dataApiFetch, dataApiUrl, getBearerToken, handleApiError, relay, sendError } from '../_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req)
  if (!token) return sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in to view your contacts.')

  try {
    if (req.method === 'GET') {
      const params = new URLSearchParams({ select: '*', order: `${safeSort(req.query.sort)},${req.query.direction === 'asc' ? 'asc' : 'desc'}` })
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
      const priority = typeof req.query.priority === 'string' ? req.query.priority : ''
      if (search) params.set('or', `(name.ilike.*${escapeFilter(search)}*,company.ilike.*${escapeFilter(search)}*,role.ilike.*${escapeFilter(search)}*)`)
      if (priorities.includes(priority as typeof priorities[number])) params.set('priority', `eq.${priority}`)
      return relay(await dataApiFetch(token, dataApiUrl('contacts', `?${params}`)), res)
    }

    if (req.method === 'POST') {
      const contact = normalizeContactInput(contactInputSchema.parse(req.body))
      const response = await dataApiFetch(token, dataApiUrl('contacts'), { method: 'POST', body: JSON.stringify(contact) })
      return relay(response, res, 201)
    }

    res.setHeader('Allow', 'GET, POST')
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.')
  } catch (error) {
    return handleApiError(error, res)
  }
}

function safeSort(value: VercelRequest['query'][string]) {
  return typeof value === 'string' && ['name', 'company', 'priority', 'created_at'].includes(value) ? value : 'created_at'
}

function escapeFilter(value: string) {
  return value.replace(/[,*()]/g, '')
}
