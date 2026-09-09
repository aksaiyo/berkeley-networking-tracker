import { createClient } from '@neondatabase/neon-js'
import { createInternalNeonAuth } from '@neondatabase/neon-js/auth'
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters'

const authUrl = import.meta.env.NEXT_PUBLIC_NEON_AUTH_URL || 'https://configure-neon-auth.example.com'
const dataApiUrl = import.meta.env.NEXT_PUBLIC_NEON_DATA_API_URL || 'https://configure-neon-data.example.com/rest/v1'

export const isNeonConfigured = Boolean(
  import.meta.env.NEXT_PUBLIC_NEON_AUTH_URL && import.meta.env.NEXT_PUBLIC_NEON_DATA_API_URL,
)

const neonAuth = createInternalNeonAuth(authUrl, { adapter: BetterAuthReactAdapter() })
export const authClient = neonAuth.adapter

// Unified Neon client configured with both public endpoints. CRUD is sent through
// the Node API, while the same token provider is available to authenticated data calls.
export const neon = createClient({ dataApi: { url: dataApiUrl, getToken: neonAuth.getJWTToken } })

export async function getAccessToken(): Promise<string> {
  const token = await neonAuth.getJWTToken()
  if (!token) throw new Error('Your session has expired. Please sign in again.')
  return token
}
