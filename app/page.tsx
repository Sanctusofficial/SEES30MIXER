'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { supabaseBrowser } from '@/lib/supabase/client'

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: PaystackSetupOptions) => { openIframe: () => void }
    }
  }
}

interface PaystackSetupOptions {
  key: string
  email: string
  amount: number
  currency?: string
  ref?: string
  metadata?: Record<string, unknown>
  callback: (response: { reference: string }) => void
  onClose: () => void
}

const TICKET_PRICE_NAIRA = Number(process.env.NEXT_PUBLIC_TICKET_PRICE_NAIRA ?? 0)

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState<'Elect' | 'Computer' | ''>('')
  const [matricNumber, setMatricNumber] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')

  const [status, setStatus] = useState<'idle' | 'paying' | 'verifying' | 'success' | 'error'>(
    'idle'
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null)

  // Live attendee counter — initial fetch + realtime subscription
  useEffect(() => {
    let isMounted = true

    async function loadCount() {
      const { count } = await supabaseBrowser
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'success')
      if (isMounted) setAttendeeCount(count ?? 0)
    }
    loadCount()

    const channel = supabaseBrowser
      .channel('public-registrations-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          if ((payload.new as { payment_status?: string }).payment_status === 'success') {
            setAttendeeCount((prev) => (prev ?? 0) + 1)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabaseBrowser.removeChannel(channel)
    }
  }, [])

  function validate(): string | null {
    if (!fullName.trim()) return 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email.'
    if (!department) return 'Select your department.'
    if (!matricNumber.trim()) return 'Enter your matric number.'
    return null
  }

  function startPayment() {
    const validationError = validate()
    if (validationError) {
      setErrorMessage(validationError)
      setStatus('error')
      return
    }

    if (typeof window.PaystackPop === 'undefined') {
      setErrorMessage('Payment system is still loading — try again in a second.')
      setStatus('error')
      return
    }

    setStatus('paying')
    setErrorMessage('')

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email,
      amount: TICKET_PRICE_NAIRA * 100, // Paystack expects kobo
      currency: 'NGN',
      metadata: { fullName, department, matricNumber },
      callback: (response) => {
        void finalizeRegistration(response.reference)
      },
      onClose: () => {
        setStatus((current) => (current === 'paying' ? 'idle' : current))
      },
    })

    handler.openIframe()
  }

  async function finalizeRegistration(reference: string) {
    setStatus('verifying')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          fullName,
          email,
          department,
          matricNumber,
          lookingForwardTo,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        let message = text
        try {
          message = JSON.parse(text).error ?? text
        } catch {
          // response wasn't JSON — use raw text
        }
        throw new Error(message || `Verification failed (${res.status})`)
      }

      setStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setErrorMessage(message)
      setStatus('error')
    }
  }

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

      <main className="min-h-screen bg-black text-white px-5 py-10 max-w-md mx-auto">
        {/* ---------- Header ---------- */}
        <div className="text-center mb-8">
          <p className="text-pink-500 tracking-widest text-sm font-bold mb-1">
            SEES&apos;30 GET READYYYYYY
          </p>
          <h1 className="glitch-title text-5xl font-black leading-none">MIXER</h1>
          <p className="text-green-400 text-xs tracking-[0.3em] mt-2">
            29TH AUGUST &middot; 12PM
          </p>
        </div>

        {/* ---------- Live counter ---------- */}
        <div className="border border-green-400/40 bg-green-400/5 rounded-xl px-4 py-3 mb-8 text-center">
          <p className="text-green-400 text-2xl font-black tabular-nums">
            {attendeeCount === null ? '—' : attendeeCount}
          </p>
          <p className="text-green-300/70 text-xs uppercase tracking-wider">
            people already locked in
          </p>
        </div>

        {/* ---------- Featuring panel ---------- */}
        <div className="border-2 border-green-400 rounded-2xl p-4 mb-8 grid grid-cols-2 gap-3 text-sm">
          {['Picnic', 'Outdoor Games', 'Good Music', 'Meet & Greet'].map((item) => (
            <div
              key={item}
              className="border border-white/20 rounded-xl py-3 text-center text-white/90"
            >
              {item}
            </div>
          ))}
        </div>

        {status === 'success' ? (
          <div className="text-center border border-green-400 rounded-2xl p-6">
            <p className="text-2xl mb-2">🛸</p>
            <h2 className="text-green-400 font-bold text-lg mb-1">You&apos;re in!</h2>
            <p className="text-white/70 text-sm">
              Your spot is confirmed. See you on the 29th at 12PM.
            </p>
          </div>
        ) : (
          <>
            <h2 className="glitch-title-sm text-2xl font-black text-center mb-6">
              Register Now
            </h2>

            <div className="space-y-5">
              <Field label="Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="input"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                />
              </Field>

              <Field label="Department">
                <div className="flex gap-6">
                  {(['Elect', 'Computer'] as const).map((dept) => (
                    <label key={dept} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="department"
                        checked={department === dept}
                        onChange={() => setDepartment(dept)}
                        className="accent-pink-500 w-4 h-4"
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Matric Number">
                <input
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  placeholder="e.g. 20/1234"
                  className="input"
                />
              </Field>

              <Field label="What are you looking forward to?">
                <input
                  value={lookingForwardTo}
                  onChange={(e) => setLookingForwardTo(e.target.value)}
                  placeholder="e.g. the games, meeting new people..."
                  className="input"
                />
              </Field>

              {status === 'error' && errorMessage && (
                <p className="text-red-400 text-sm text-center">{errorMessage}</p>
              )}

              <button
                onClick={startPayment}
                disabled={status === 'paying' || status === 'verifying'}
                className="w-full bg-pink-500 hover:bg-pink-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(236,72,153,0.5)]"
              >
                {status === 'paying' && 'Waiting for payment...'}
                {status === 'verifying' && 'Confirming payment...'}
                {status === 'idle' || status === 'error'
                  ? `Pay ₦${TICKET_PRICE_NAIRA.toLocaleString()} & Reserve My Spot`
                  : null}
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-white/80 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

