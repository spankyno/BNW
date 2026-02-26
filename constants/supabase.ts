import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://lmkkjkanhywtzpskxmjm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2tqa2FuaHl3dHpwc2t4bWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTc3ODcsImV4cCI6MjA4NzQzMzc4N30.QN4KFyNVPtym5SXR-AWwu5zsiLmiLxaTwt139se9Y9s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
});
