import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.info('[Supabase] Configuração carregada', {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseKey),
})

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variáveis do Supabase não configuradas.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
