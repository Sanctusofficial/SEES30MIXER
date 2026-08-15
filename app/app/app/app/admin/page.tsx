
'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

interface Registration {
  id: string
  full_name: string
  email: string
  department: string
  matric_number: string
  looking_forward_to: string | null
  amount_paid_kobo: number
  created_at: string
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authed) return

    let isMounted = true
    setLoading(true)

    async function loadInitial() {
      const { data } = await supabaseBrowser
        .from('registrations')
        .select(
          'id, full_name, email, department, matric_number, looking_forward_to, amount_paid_kobo, created_at'
        )
        .eq('payment_status', 'success')
        .order('created_at', { ascending: false })

      if (isMounted && data) setRegistrations(data as Registration[])
      if (isMounted) setLoading(false)
    }
    loadInitial()

    const channel = supabaseBrowser
      .channel('admin-registrations-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          const row = payload.new as Registration & { payment_status: string }
          if (row.payment_status === 'success') {
            setRegistrations((prev) => [row, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabaseBrowser.removeChannel(channel)
    }
  }, [authed])

  if (!authed) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-bold text-pink-500 mb-4 text-center">Admin Login</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Password"
            className="input mb-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && passwordInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
                setAuthed(true)
              }
            }}
          />
          <button
            onClick={() =>
              passwordInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD && setAuthed(true)
            }
            className="w-full bg-pink-500 text-black font-bold py-3 rounded-xl"
          >
            Enter
          </button>
          <p className="text-white/40 text-xs mt-4 text-center">
            Note: this is a light client-side gate, not full authentication. See SETUP.md if you
            need stronger protection.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-pink-500">Registrations</h1>
        <p className="text-green-400 font-bold">{registrations.length} confirmed</p>
      </div>

      {loading && <p className="text-white/50">Loading...</p>}

      <div className="space-y-3">
        {registrations.map((r) => (
          <div key={r.id} className="border border-white/15 rounded-xl p-4">
            <div className="flex justify-between items-start mb-1">
              <p className="font-bold">{r.full_name}</p>
              <span className="text-xs text-green-400">
                ₦{(r.amount_paid_kobo / 100).toLocaleString()}
              </span>
            </div>
            <p className="text-white/60 text-sm">{r.email}</p>
            <p className="text-white/60 text-sm">
              {r.department} &middot; {r.matric_number}
            </p>
            {r.looking_forward_to && (
              <p className="text-white/40 text-xs mt-2 italic">
                &ldquo;{r.looking_forward_to}&rdquo;
              </p>
            )}
            <p className="text-white/30 text-xs mt-2">
              {new Date(r.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
