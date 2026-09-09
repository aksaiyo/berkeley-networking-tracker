import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthView, NeonAuthUIProvider, useAuthData } from '@neondatabase/auth-ui'
import {
  ArrowDownAZ, ArrowUpAZ, CalendarDays, ChevronDown, LogOut,
  MapPin, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, UsersRound, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { contactsApi } from './lib/api'
import { authClient, isNeonConfigured } from './lib/neon'
import type { Contact, ContactInput, Priority } from '../shared/contact'
import { contactInputSchema } from '../shared/contact'

const emptyForm: ContactInput = { name: '', company: '', role: '', where_met: '', notes: '', priority: 'medium' }

export default function App() {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/">
      <SessionGate />
    </NeonAuthUIProvider>
  )
}

function SessionGate() {
  const session = useAuthData({ queryFn: () => authClient.getSession(), cacheKey: 'bearlink-session' })
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  if (!isNeonConfigured) return <SetupScreen />
  if (session.isPending) return <FullPageLoader />
  if (!session.data) {
    return (
      <div className="min-h-screen bg-[#071c39] lg:grid lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden p-16 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
          <div className="absolute -right-12 top-12 h-80 w-80 rounded-full border border-[#fdb515]/30" />
          <Brand light />
          <div className="relative max-w-xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[.18em] text-[#fdb515]"><ShieldCheck size={18} /> Private by design</p>
            <h1 className="text-balance text-6xl font-semibold leading-[1.02] tracking-[-.04em]">Relationships deserve more than a spreadsheet.</h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-blue-100/75">Keep the people you meet at Berkeley close—without letting their details leave your private network.</p>
          </div>
          <p className="text-sm text-blue-100/55">Built for the Berkeley community.</p>
        </section>
        <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-5 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden"><Brand /></div>
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(7,28,57,.12)] sm:p-9">
              <div className="mb-7">
                <p className="text-sm font-semibold text-[#176fbd]">Welcome to BearLink</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#071c39]">{authMode === 'sign-in' ? 'Sign in to your network' : 'Create your account'}</h2>
              </div>
              <AuthView path={authMode} />
              <button className="mt-6 w-full text-center text-sm font-medium text-slate-600 hover:text-[#176fbd]" onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                {authMode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }
  return <Dashboard user={session.data.user} />
}

function Dashboard({ user }: { user: { name?: string | null; email?: string | null } }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [sort, setSort] = useState('created_at')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [editing, setEditing] = useState<Contact | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Contact | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useQuery({
    queryKey: ['contacts', debouncedSearch, priority, sort, direction],
    queryFn: () => contactsApi.list({ search: debouncedSearch, priority, sort, direction }),
  })

  const remove = useMutation({
    mutationFn: contactsApi.remove,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contacts'] }); setDeleting(null); toast.success('Contact deleted') },
    onError: (error) => toast.error(error.message),
  })

  const contacts = useMemo(() => query.data ?? [], [query.data])
  const counts = useMemo(() => ({ high: contacts.filter((c) => c.priority === 'high').length }), [contacts])

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    void Promise.resolve(context.registerTool({
      name: 'list_contacts',
      title: 'List contacts',
      description: 'List the signed-in user’s visible contacts using the active search, priority, and sort settings.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => contactsApi.list({ search: debouncedSearch, priority, sort, direction }),
    }, { signal: lifecycle.signal })).catch(() => undefined)
    void Promise.resolve(context.registerTool({
      name: 'create_contact',
      title: 'Create contact',
      description: 'Create a contact in the signed-in user’s private network.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['name', 'priority'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 }, company: { type: 'string' },
          role: { type: 'string' }, where_met: { type: 'string' }, notes: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const validated = contactInputSchema.parse(input)
        const created = await contactsApi.create(validated)
        await queryClient.invalidateQueries({ queryKey: ['contacts'] })
        toast.success('Contact added')
        return { contact: created[0] }
      },
    }, { signal: lifecycle.signal })).catch(() => undefined)
    return () => lifecycle.abort()
  }, [debouncedSearch, direction, priority, queryClient, sort])

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-[#071c39]">{user.name || 'BearLink member'}</p><p className="text-xs text-slate-500">{user.email}</p></div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e8f2fb] font-semibold text-[#176fbd]">{(user.name || user.email || 'B').charAt(0).toUpperCase()}</div>
            <button aria-label="Sign out" title="Sign out" onClick={() => authClient.signOut()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#071c39]"><LogOut size={19} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-sm font-semibold uppercase tracking-[.14em] text-[#176fbd]">Your community</p><h1 className="text-4xl font-semibold tracking-[-.035em] text-[#071c39]">People worth keeping close</h1><p className="mt-2 text-slate-500">A private home for the connections you’re building.</p></div>
          <button onClick={() => { setEditing(null); setFormOpen(true) }} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#176fbd] px-5 font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#0f5fa6]"><Plus size={19} /> Add contact</button>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat icon={<UsersRound />} label="Total contacts" value={contacts.length} />
          <Stat icon={<ShieldCheck />} label="High priority" value={counts.high} accent />
          <Stat icon={<CalendarDays />} label="Added this month" value={contacts.filter(isThisMonth).length} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(7,28,57,.05)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:p-5">
            <label className="relative flex-1"><span className="sr-only">Search contacts</span><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, or role" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#176fbd] focus:bg-white" /></label>
            <FilterSelect label="Priority" value={priority} onChange={setPriority} options={[['all','All priorities'],['high','High'],['medium','Medium'],['low','Low']]} />
            <FilterSelect label="Sort" value={sort} onChange={setSort} options={[['created_at','Date added'],['name','Name'],['company','Company'],['priority','Priority']]} />
            <button onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">{direction === 'asc' ? <ArrowUpAZ size={18} /> : <ArrowDownAZ size={18} />}</button>
          </div>
          {query.isLoading ? <LoadingRows /> : query.isError ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : contacts.length === 0 ? <EmptyState filtered={Boolean(search || priority !== 'all')} add={() => setFormOpen(true)} /> : <ContactList contacts={contacts} edit={(contact) => { setEditing(contact); setFormOpen(true) }} remove={setDeleting} />}
        </section>
      </main>

      {formOpen && <ContactDialog contact={editing} close={() => { setFormOpen(false); setEditing(null) }} />}
      {deleting && <ConfirmDelete contact={deleting} busy={remove.isPending} close={() => setDeleting(null)} confirm={() => remove.mutate(deleting.id)} />}
    </div>
  )
}

function ContactList({ contacts, edit, remove }: { contacts: Contact[]; edit: (c: Contact) => void; remove: (c: Contact) => void }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500"><th className="px-6 py-4 font-semibold">Contact</th><th className="px-6 py-4 font-semibold">Company & role</th><th className="px-6 py-4 font-semibold">Where you met</th><th className="px-6 py-4 font-semibold">Priority</th><th className="px-6 py-4"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{contacts.map((contact) => <tr key={contact.id} className="group transition hover:bg-[#f8fbfe]"><td className="px-6 py-5"><div className="flex items-center gap-3"><Avatar name={contact.name} /><div><p className="font-semibold text-[#071c39]">{contact.name}</p><p className="mt-1 max-w-[18rem] truncate text-sm text-slate-500">{contact.notes || 'No notes yet'}</p></div></div></td><td className="px-6 py-5"><p className="text-sm font-medium text-slate-700">{contact.company || '—'}</p><p className="mt-1 text-sm text-slate-500">{contact.role || 'No role added'}</p></td><td className="px-6 py-5 text-sm text-slate-600">{contact.where_met || '—'}</td><td className="px-6 py-5"><PriorityPill value={contact.priority} /></td><td className="px-6 py-5"><div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100"><IconButton label={`Edit ${contact.name}`} onClick={() => edit(contact)}><Pencil size={17} /></IconButton><IconButton label={`Delete ${contact.name}`} danger onClick={() => remove(contact)}><Trash2 size={17} /></IconButton></div></td></tr>)}</tbody></table></div>
      <div className="divide-y divide-slate-100 md:hidden">{contacts.map((contact) => <article key={contact.id} className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Avatar name={contact.name} /><div><h3 className="font-semibold text-[#071c39]">{contact.name}</h3><p className="text-sm text-slate-500">{[contact.role, contact.company].filter(Boolean).join(' · ') || 'Details not added'}</p></div></div><PriorityPill value={contact.priority} /></div><div className="mt-4 space-y-2 text-sm text-slate-600">{contact.where_met && <p className="flex gap-2"><MapPin size={16} className="mt-0.5 text-slate-400" /> {contact.where_met}</p>}{contact.notes && <p className="line-clamp-2">{contact.notes}</p>}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => edit(contact)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"><Pencil size={15} /> Edit</button><IconButton label={`Delete ${contact.name}`} danger onClick={() => remove(contact)}><Trash2 size={17} /></IconButton></div></article>)}</div>
    </>
  )
}

function ContactDialog({ contact, close }: { contact: Contact | null; close: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ContactInput>(contact ? { name: contact.name, company: contact.company, role: contact.role, where_met: contact.where_met, notes: contact.notes, priority: contact.priority } : emptyForm)
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => contact ? contactsApi.update(contact.id, form) : contactsApi.create(form),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['contacts'] }); toast.success(contact ? 'Contact updated' : 'Contact added'); close() },
    onError: (err) => setError(err.message),
  })
  function update<K extends keyof ContactInput>(key: K, value: ContactInput[K]) { setForm((old) => ({ ...old, [key]: value })); setError('') }
  function submit(event: React.FormEvent) { event.preventDefault(); if (!form.name.trim()) return setError('Please enter a name.'); mutation.mutate() }
  return (
    <Modal close={close} title={contact ? 'Edit contact' : 'Add a new contact'}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Name" required value={form.name} onChange={(v) => update('name', v)} placeholder="Maya Chen" /><Field label="Company" value={form.company || ''} onChange={(v) => update('company', v)} placeholder="Acme Labs" /><Field label="Role" value={form.role || ''} onChange={(v) => update('role', v)} placeholder="Product manager" /><Field label="Where you met" value={form.where_met || ''} onChange={(v) => update('where_met', v)} placeholder="Haas alumni event" /></div>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Priority</span><select value={form.priority} onChange={(e) => update('priority', e.target.value as Priority)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-[#176fbd]"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Notes</span><textarea value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={4} placeholder="Topics you discussed, follow-up ideas…" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#176fbd]" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-3 pt-1"><button type="button" onClick={close} className="h-11 rounded-xl border border-slate-200 px-5 font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={mutation.isPending} className="h-11 rounded-xl bg-[#176fbd] px-5 font-semibold text-white hover:bg-[#0f5fa6] disabled:opacity-60">{mutation.isPending ? 'Saving…' : contact ? 'Save changes' : 'Add contact'}</button></div>
      </form>
    </Modal>
  )
}

function ConfirmDelete({ contact, busy, close, confirm }: { contact: Contact; busy: boolean; close: () => void; confirm: () => void }) {
  return <Modal close={close} title="Delete contact?"><p className="text-slate-600">This will permanently remove <strong className="text-[#071c39]">{contact.name}</strong> and their notes from your network.</p><div className="mt-7 flex justify-end gap-3"><button onClick={close} className="h-11 rounded-xl border border-slate-200 px-5 font-semibold">Cancel</button><button disabled={busy} onClick={confirm} className="h-11 rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{busy ? 'Deleting…' : 'Delete contact'}</button></div></Modal>
}

function Modal({ close, title, children }: { close: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => { const listener = (e: KeyboardEvent) => e.key === 'Escape' && close(); document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener) }, [close])
  return <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 grid place-items-end bg-[#071c39]/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className="animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 id="modal-title" className="text-2xl font-semibold tracking-tight text-[#071c39]">{title}</h2><button onClick={close} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>{children}</div></div>
}

function Brand({ light = false }: { light?: boolean }) { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fdb515] font-black text-[#071c39] shadow-sm">B</div><div><p className={`text-lg font-bold leading-5 tracking-tight ${light ? 'text-white' : 'text-[#071c39]'}`}>BearLink</p><p className={`text-[11px] font-semibold uppercase tracking-[.12em] ${light ? 'text-blue-100/60' : 'text-slate-400'}`}>Networking tracker</p></div></div> }
function Stat({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) { return <div className={`flex items-center gap-4 rounded-2xl border p-5 ${accent ? 'border-[#fdb515]/40 bg-[#fffaf0]' : 'border-slate-200 bg-white'}`}><div className={`grid h-11 w-11 place-items-center rounded-xl ${accent ? 'bg-[#fdb515]/20 text-[#9a6500]' : 'bg-[#e8f2fb] text-[#176fbd]'}`}>{icon}</div><div><p className="text-2xl font-semibold tracking-tight text-[#071c39]">{value}</p><p className="text-sm text-slate-500">{label}</p></div></div> }
function Avatar({ name }: { name: string }) { const initials = name.split(' ').slice(0,2).map((p) => p[0]).join('').toUpperCase(); return <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f2fb] text-sm font-bold text-[#176fbd]">{initials}</div> }
function PriorityPill({ value }: { value: Priority }) { const styles = { high: 'bg-red-50 text-red-700 ring-red-600/10', medium: 'bg-amber-50 text-amber-700 ring-amber-600/10', low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${styles[value]}`}>{value}</span> }
function IconButton({ label, danger = false, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) { return <button aria-label={label} title={label} onClick={onClick} className={`rounded-lg p-2 transition ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-blue-50 hover:text-[#176fbd]'}`}>{children}</button> }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) { return <label className="relative"><span className="sr-only">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 min-w-40 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-[#176fbd]">{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /></label> }
function Field({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; required?: boolean }) { return <label><span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span><input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#176fbd]" /></label> }
function LoadingRows() { return <div className="space-y-4 p-6">{[1,2,3,4].map((n) => <div key={n} className="flex animate-pulse items-center gap-4"><div className="h-11 w-11 rounded-xl bg-slate-100"/><div className="flex-1"><div className="h-4 w-36 rounded bg-slate-100"/><div className="mt-2 h-3 w-52 rounded bg-slate-100"/></div></div>)}</div> }
function EmptyState({ filtered, add }: { filtered: boolean; add: () => void }) { return <div className="grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e8f2fb] text-[#176fbd]"><UserRound size={28}/></div><h2 className="mt-5 text-xl font-semibold text-[#071c39]">{filtered ? 'No matches found' : 'Your network starts here'}</h2><p className="mx-auto mt-2 max-w-sm text-slate-500">{filtered ? 'Try changing your search or priority filter.' : 'Add the people you want to remember and keep every useful detail in one private place.'}</p>{!filtered && <button onClick={add} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176fbd] px-4 py-2.5 font-semibold text-white"><Plus size={18}/> Add your first contact</button>}</div></div> }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="grid min-h-72 place-items-center p-8 text-center"><div><h2 className="text-lg font-semibold text-[#071c39]">We couldn’t load your contacts</h2><p className="mt-2 text-slate-500">{message}</p><button onClick={retry} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 font-semibold">Try again</button></div></div> }
function FullPageLoader() { return <div className="grid min-h-screen place-items-center bg-[#f4f7fb]"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#176fbd]/20 border-t-[#176fbd]"/><p className="mt-4 text-sm font-medium text-slate-500">Opening your private network…</p></div></div> }
function SetupScreen() { return <div className="grid min-h-screen place-items-center bg-[#071c39] p-6"><div className="max-w-lg rounded-3xl bg-white p-8 shadow-2xl"><Brand/><div className="mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldCheck/></div><h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#071c39]">Connect your Neon project</h1><p className="mt-3 leading-7 text-slate-600">Copy <code className="rounded bg-slate-100 px-1.5 py-1 text-sm">.env.example</code> to <code className="rounded bg-slate-100 px-1.5 py-1 text-sm">.env.local</code>, add your public Neon Auth and Data API URLs, then restart the app.</p><p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">Your Postgres connection string and secrets must never use a public environment variable.</p></div></div> }
function isThisMonth(contact: Contact) { const date = new Date(contact.created_at); const now = new Date(); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() }
