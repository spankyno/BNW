import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Note } from '@/types/notes';
import { supabase } from '@/constants/supabase';

const NOTES_KEY = '@notes_app_notes';
const SETTINGS_KEY = '@notes_app_settings';
const MAX_DAILY_NOTES = 10;
const MAX_OPEN_TABS = 10;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10);
}

interface Settings {
  showLineNumbers: boolean;
  cookieAccepted: boolean;
}

interface AuthState {
  session: { user: { id: string; email: string | null } } | null;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_SIGN_UP_COOLDOWN_MS = 60_000;
const MAX_SIGN_UP_COOLDOWN_MS = 3_600_000;
const SIGN_UP_ALREADY_EXISTS_HINT = 'Ya existe una cuenta con ese email. Prueba con “Iniciar sesión”.';
const SIGN_UP_RATE_LIMIT_HINT = 'Supabase bloqueó temporalmente nuevos correos de alta. Espera más tiempo o usa “Iniciar sesión” si la cuenta ya se creó.';
const EMAIL_NOT_CONFIRMED_HINT = 'Tu cuenta existe, pero el email no está confirmado. Revisa tu bandeja de entrada o desactiva la confirmación de email en Supabase Auth para pruebas.';

function getSignUpCooldownMsFromError(message: string): number {
  const lower = message.toLowerCase();
  const patterns = [
    /(\d+)\s*seg/,
    /(\d+)\s*second/,
    /(\d+)\s*s\b/,
    /(\d+)\s*min/,
    /(\d+)\s*minute/,
    /(\d+)\s*m\b/,
    /(\d+)\s*hour/,
    /(\d+)\s*h\b/,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    if (pattern.source.includes('hour') || pattern.source.includes('h\\b')) {
      return Math.min(value * 3_600_000, MAX_SIGN_UP_COOLDOWN_MS);
    }
    if (pattern.source.includes('min') || pattern.source.includes('minute') || pattern.source.includes('m\\b')) {
      return Math.min(value * 60_000, MAX_SIGN_UP_COOLDOWN_MS);
    }
    return Math.min(value * 1000, MAX_SIGN_UP_COOLDOWN_MS);
  }

  return DEFAULT_SIGN_UP_COOLDOWN_MS;
}

function getAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('user already registered')) {
    return SIGN_UP_ALREADY_EXISTS_HINT;
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
    const cooldownMs = getSignUpCooldownMsFromError(message);
    if (cooldownMs >= 3_600_000) {
      return `Demasiados intentos de registro. El bloqueo puede tardar hasta 1 hora. ${SIGN_UP_RATE_LIMIT_HINT}`;
    }
    const waitSeconds = Math.ceil(cooldownMs / 1000);
    return `Demasiados intentos de registro. Espera al menos ${waitSeconds} segundos. ${SIGN_UP_RATE_LIMIT_HINT}`;
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return EMAIL_NOT_CONFIRMED_HINT;
  }
  if (lower.includes('invalid login credentials')) {
    return 'Credenciales inválidas. Verifica email/contraseña o crea una cuenta primero.';
  }
  return message;
}

function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('email rate limit exceeded') || lower.includes('rate limit');
}

interface NotesPayload {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const [NotesProvider, useNotes] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    showLineNumbers: false,
    cookieAccepted: false,
  });
  const [auth, setAuth] = useState<AuthState>({
    session: null,
    isLoading: true,
    error: null,
  });
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [signUpCooldownUntil, setSignUpCooldownUntil] = useState<number>(0);

  const notesQuery = useQuery({
    queryKey: ['notes', auth.session?.user?.id ?? 'local'],
    queryFn: async () => {
      if (auth.session?.user?.id) {
        const { data, error } = await supabase
          .from('notes')
          .select('id,title,content,created_at,updated_at')
          .eq('user_id', auth.session.user.id)
          .order('updated_at', { ascending: false });
        if (error) {
          console.log('Supabase notes fetch error:', error.message);
          throw new Error('No se pudieron cargar las notas desde Supabase.');
        }
        return (data ?? []).map((row: NotesPayload) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
      const stored = await AsyncStorage.getItem(NOTES_KEY);
      return stored ? (JSON.parse(stored) as Note[]) : [];
    },
    enabled: !auth.isLoading,
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      return stored ? (JSON.parse(stored) as Settings) : { showLineNumbers: false, cookieAccepted: false };
    },
  });

  useEffect(() => {
    if (notesQuery.data) {
      setNotes(notesQuery.data);
    }
  }, [notesQuery.data]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }
        if (error) {
          console.log('Supabase getSession error:', error.message);
          setAuth({ session: null, isLoading: false, error: getAuthErrorMessage(error.message) });
          return;
        }

        const currentSession = data.session
          ? {
              user: {
                id: data.session.user.id,
                email: data.session.user.email ?? null,
              },
            }
          : null;
        setAuth({ session: currentSession, isLoading: false, error: null });
      })
      .catch((sessionError: unknown) => {
        if (!mounted) {
          return;
        }
        console.log('Supabase getSession unexpected error:', sessionError);
        setAuth({ session: null, isLoading: false, error: 'No se pudo recuperar la sesión actual.' });
      });

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }
      console.log('Supabase auth state changed:', event);
      const mappedSession = session
        ? {
            user: {
              id: session.user.id,
              email: session.user.email ?? null,
            },
          }
        : null;
      setAuth((prev) => ({ ...prev, session: mappedSession, isLoading: false }));
    });

    return () => {
      mounted = false;
      authListener.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const persistNotes = useMutation({
    mutationFn: async (updated: Note[]) => {
      if (auth.session?.user?.id) {
        const payload = updated.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.content,
          created_at: note.createdAt,
          updated_at: note.updatedAt,
          user_id: auth.session?.user?.id,
        }));
        const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'id' });
        if (error) {
          console.log('Supabase notes sync error:', error.message);
          throw new Error('No se pudieron sincronizar las notas con Supabase.');
        }
        return updated;
      }
      await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const persistSettings = useMutation({
    mutationFn: async (updated: Settings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const notesCreatedToday = useMemo(() => {
    const today = getDateKey(new Date().toISOString());
    return notes.filter((n) => getDateKey(n.createdAt) === today).length;
  }, [notes]);

  const canCreateNote = notesCreatedToday < MAX_DAILY_NOTES;

  const addNote = useCallback((): Note | null => {
    if (!canCreateNote) return null;
    const now = new Date();
    const note: Note = {
      id: generateId(),
      title: `Nota ${formatDateTime(now)}`,
      content: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    persistNotes.mutate(updated);

    if (openTabIds.length < MAX_OPEN_TABS) {
      setOpenTabIds((prev) => [...prev, note.id]);
    }
    setActiveTabId(note.id);
    return note;
  }, [canCreateNote, notes, openTabIds.length, persistNotes]);

  const updateNote = useCallback(
    (id: string, changes: Partial<Pick<Note, 'title' | 'content'>>) => {
      const updated = notes.map((n) =>
        n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
      );
      setNotes(updated);
      persistNotes.mutate(updated);
    },
    [notes, persistNotes]
  );

  const signUp = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    if (signUpCooldownUntil > now) {
      const waitSeconds = Math.ceil((signUpCooldownUntil - now) / 1000);
      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: `Demasiados intentos de registro. Reintenta en ${waitSeconds}s o inicia sesión si la cuenta ya existe.`,
      }));
      return false;
    }

    setAuth((prev) => ({ ...prev, isLoading: true, error: null }));
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuth((prev) => ({ ...prev, isLoading: false, error: 'Completa email y contraseña.' }));
      return false;
    }

    try {
      console.log('Supabase sign up attempt:', trimmedEmail);
      const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
      if (error) {
        const mappedMessage = getAuthErrorMessage(error.message);
        if (isRateLimitError(error.message)) {
          const cooldownMs = getSignUpCooldownMsFromError(error.message);
          const nextCooldownUntil = Date.now() + cooldownMs;
          setSignUpCooldownUntil(nextCooldownUntil);
          console.log('Supabase sign up rate limit triggered. Cooldown ms:', cooldownMs, 'Cooldown until:', new Date(nextCooldownUntil).toISOString());

          const signInFallback = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (!signInFallback.error && signInFallback.data.session) {
            console.log('Supabase sign up fallback sign in succeeded for:', trimmedEmail);
            const fallbackSession = {
              user: {
                id: signInFallback.data.session.user.id,
                email: signInFallback.data.session.user.email ?? null,
              },
            };
            setSignUpCooldownUntil(0);
            setAuth({ session: fallbackSession, isLoading: false, error: null });
            return true;
          }

          console.log('Supabase sign up fallback sign in failed:', signInFallback.error?.message ?? 'unknown error');
        }

        setAuth((prev) => ({ ...prev, isLoading: false, error: mappedMessage }));
        return false;
      }

      setSignUpCooldownUntil(0);
      if (data.session) {
        const session = {
          user: {
            id: data.session.user.id,
            email: data.session.user.email ?? null,
          },
        };
        setAuth({ session, isLoading: false, error: null });
        return true;
      }

      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Cuenta creada. Revisa tu email para confirmar la cuenta y luego inicia sesión.',
      }));
      return false;
    } catch (signUpError: unknown) {
      console.log('Supabase sign up unexpected error:', signUpError);
      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: 'No se pudo crear la cuenta por un error de red. Intenta nuevamente.',
      }));
      return false;
    }
  }, [email, password, signUpCooldownUntil]);

  const signIn = useCallback(async (): Promise<boolean> => {
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }));
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuth((prev) => ({ ...prev, isLoading: false, error: 'Completa email y contraseña.' }));
      return false;
    }

    try {
      console.log('Supabase sign in attempt:', trimmedEmail);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: getAuthErrorMessage(error.message) }));
        return false;
      }

      const session = data.session
        ? {
            user: {
              id: data.session.user.id,
              email: data.session.user.email ?? null,
            },
          }
        : null;
      setAuth({ session, isLoading: false, error: null });
      return true;
    } catch (signInError: unknown) {
      console.log('Supabase sign in unexpected error:', signInError);
      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: 'No se pudo iniciar sesión por un error de red. Intenta nuevamente.',
      }));
      return false;
    }
  }, [email, password]);

  const signOut = useCallback(async () => {
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('Supabase sign out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuth((prev) => ({ ...prev, isLoading: false, error: getAuthErrorMessage(error.message) }));
        return;
      }
      setAuth({ session: null, isLoading: false, error: null });
    } catch (signOutError: unknown) {
      console.log('Supabase sign out unexpected error:', signOutError);
      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: 'No se pudo cerrar sesión en este momento.',
      }));
    }
  }, []);

  const deleteNote = useCallback(
    (id: string) => {
      const updated = notes.filter((n) => n.id !== id);
      setNotes(updated);
      persistNotes.mutate(updated);
      if (auth.session?.user?.id) {
        supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .eq('user_id', auth.session.user.id)
          .then(({ error }) => {
            if (error) {
              console.log('Supabase delete error:', error.message);
            }
          });
      }
      setOpenTabIds((prev) => prev.filter((tid) => tid !== id));
      if (activeTabId === id) {
        setActiveTabId(openTabIds.find((tid) => tid !== id) ?? null);
      }
    },
    [notes, activeTabId, openTabIds, persistNotes, auth.session?.user?.id]
  );

  const openTab = useCallback(
    (id: string) => {
      if (!openTabIds.includes(id)) {
        if (openTabIds.length >= MAX_OPEN_TABS) {
          setOpenTabIds((prev) => [...prev.slice(1), id]);
        } else {
          setOpenTabIds((prev) => [...prev, id]);
        }
      }
      setActiveTabId(id);
    },
    [openTabIds]
  );

  const closeTab = useCallback(
    (id: string) => {
      const newTabs = openTabIds.filter((tid) => tid !== id);
      setOpenTabIds(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
      }
    },
    [openTabIds, activeTabId]
  );

  const getNotesForDate = useCallback(
    (dateStr: string): Note[] => {
      return notes.filter((n) => getDateKey(n.createdAt) === dateStr);
    },
    [notes]
  );

  const getDatesWithNotes = useMemo(() => {
    const dates = new Set<string>();
    notes.forEach((n) => dates.add(getDateKey(n.createdAt)));
    return dates;
  }, [notes]);

  const searchNotes = useCallback(
    (query: string, startDate?: string, endDate?: string): Note[] => {
      const q = query.toLowerCase();
      return notes.filter((n) => {
        const matchesQuery =
          !query || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
        const noteDate = getDateKey(n.createdAt);
        const matchesStart = !startDate || noteDate >= startDate;
        const matchesEnd = !endDate || noteDate <= endDate;
        return matchesQuery && matchesStart && matchesEnd;
      });
    },
    [notes]
  );

  const toggleLineNumbers = useCallback(() => {
    const updated = { ...settings, showLineNumbers: !settings.showLineNumbers };
    setSettings(updated);
    persistSettings.mutate(updated);
  }, [settings, persistSettings]);

  const acceptCookie = useCallback(() => {
    const updated = { ...settings, cookieAccepted: true };
    setSettings(updated);
    persistSettings.mutate(updated);
  }, [settings, persistSettings]);

  const getNoteById = useCallback(
    (id: string): Note | undefined => notes.find((n) => n.id === id),
    [notes]
  );

  return {
    notes,
    openTabIds,
    activeTabId,
    settings,
    canCreateNote,
    notesCreatedToday,
    isLoading: notesQuery.isLoading || auth.isLoading,
    addNote,
    updateNote,
    deleteNote,
    openTab,
    closeTab,
    setActiveTabId,
    getNotesForDate,
    getDatesWithNotes,
    searchNotes,
    toggleLineNumbers,
    acceptCookie,
    getNoteById,
    auth,
    email,
    password,
    setEmail,
    setPassword,
    signUp,
    signIn,
    signOut,
    signUpCooldownUntil,
  };
});
