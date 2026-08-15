
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    status: 'success' | 'failed' | 'abandoned'
    reference: string
    amount: number // in kobo
    currency: string
    customer: { email: string }
    metadata?: Record<string, unknown>
  }
}

/**
 * Verifies a transaction reference directly with Paystack's servers.
 * This is the ONLY source of truth for "did the payment actually succeed" —
 * never trust a success flag sent from the browser, since that can be faked.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    throw new Error(`Paystack verify request failed: ${res.status}`)
  }

  return res.json()
}
