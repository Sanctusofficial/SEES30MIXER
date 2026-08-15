import { createClient } from '@supabase/supabase-js'

// Server-only client — uses the SERVICE ROLE key, which bypasses RLS.
// NEVER import this file into a client component. It only runs inside
// API routes (app/api/**/route.ts), which execute on the server.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
)

