import { createClient } from '@supabase/supabase-js'

// Browser client — safe to use in client components.
// Uses the anon key, which is public by design; access is controlled
// by the Row Level Security policies in supabase-schema.sql.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

