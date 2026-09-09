/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_NEON_AUTH_URL?: string
  readonly NEXT_PUBLIC_NEON_DATA_API_URL?: string
}

interface ModelContext {
  registerTool(tool: {
    name: string
    title?: string
    description: string
    inputSchema: Record<string, unknown>
    annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
    execute(input: unknown): unknown | Promise<unknown>
  }, options?: { signal?: AbortSignal }): void | Promise<void>
}

interface Document { readonly modelContext?: ModelContext }
