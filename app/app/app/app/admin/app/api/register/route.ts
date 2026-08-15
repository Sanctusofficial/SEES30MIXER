import { NextResponse } from 'next/server'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { supabaseServer } from '@/lib/supabase/server'

export const maxDuration = 30

interface RegisterPayload {
  reference: string
  fullName: string
  email: string
  department: 'Elect' | 'Computer'
  matricNumber: string
  lookingForwardTo: string
}

const EXPECTED_AMOUNT_KOBO = Number(process.env.TICKET_PRICE_KOBO)

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RegisterPayload>

    const { reference, fullName, email, department, matricNumber, lookingForwardTo } = body

    if (!reference || !fullName || !email || !department || !matricNumber) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (department !== 'Elect' && department !== 'Computer') {
      return NextResponse.json({ error: 'Invalid department.' }, { status: 400 })
    }

    // 1. Verify the payment directly with Paystack — never trust the client.
    const verification = await verifyPaystackTransaction(reference)

    if (!verification.status || verification.data.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment could not be verified as successful.' },
        { status: 402 }
      )
    }

    // 2. Confirm the amount actually paid matches the ticket price.
    //    Prevents someone from paying ₦1 and reusing a valid reference format.
    if (
      Number.isFinite(EXPECTED_AMOUNT_KOBO) &&
      verification.data.amount !== EXPECTED_AMOUNT_KOBO
    ) {
      return NextResponse.json(
        { error: 'Payment amount does not match the ticket price.' },
        { status: 402 }
      )
    }

    // 3. Write the registration. The unique constraints on paystack_reference
    //    and matric_number (for successful payments) in the DB schema stop
    //    double-registration even under a race condition.
    const { error: insertError } = await supabaseServer.from('registrations').insert({
      full_name: fullName,
      email,
      department,
      matric_number: matricNumber,
      looking_forward_to: lookingForwardTo ?? null,
      paystack_reference: reference,
      amount_paid_kobo: verification.data.amount,
      payment_status: 'success',
    })

    if (insertError) {
      // 23505 = unique_violation — most likely a duplicate reference or matric number
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This registration has already been recorded.' },
          { status: 409 }
        )
      }
      console.error('Supabase insert error:', insertError.message)
      return NextResponse.json({ error: 'Could not save registration.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.'
    console.error('register/verify error:', mess
