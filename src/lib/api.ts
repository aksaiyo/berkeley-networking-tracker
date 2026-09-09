import type { Contact, ContactInput } from '../../shared/contact'
import { getAccessToken } from './neon'

interface ContactQuery {
  search: string
  priority: string
  sort: string
  direction: 'asc' | 'desc'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message ?? 'The request could not be completed.')
  return body as T
}

export const contactsApi = {
  list(query: ContactQuery) {
    const params = new URLSearchParams({
      search: query.search,
      priority: query.priority,
      sort: query.sort,
      direction: query.direction,
    })
    return request<Contact[]>(`/api/contacts?${params}`)
  },
  create(input: ContactInput) {
    return request<Contact[]>('/api/contacts', { method: 'POST', body: JSON.stringify(input) })
  },
  update(id: string, input: Partial<ContactInput>) {
    return request<Contact[]>(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  },
  remove(id: string) {
    return request<Contact[]>(`/api/contacts/${id}`, { method: 'DELETE' })
  },
}
