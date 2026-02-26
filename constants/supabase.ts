import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ahora el código busca la variable, si no la encuentra usa la de respaldo (opcional)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lmkkjkanhywtzpskxmjm.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'tu_clave_larga_aqui';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
});
