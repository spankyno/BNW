import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Note } from '@/types/notes';
import { supabase } from '@/constants/supabase';

const NOTES_KEY = '@notes_app_notes';
const LOCAL_FILES_KEY = '@notes_app_local_files';
const SETTINGS_KEY = '@notes_app_settings';
const FAVORITE_SYNCED_NOTE_IDS_KEY = '@notes_app_favorite_synced_note_ids';
const MAX_DAILY_NOTES = 10;
const MAX_OPEN_TABS = 10;
const LOCAL_FILES_DIR_NAME = 'bnw-local-files';

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

function sanitizeFileName(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'nota';
}

function getFileTitle(fileName: string): string {
  return fileName.replace(/\.txt$/i, '').trim() || 'Archivo local';
}

function triggerWebDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
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

async function ensureLocalFilesDirectory(): Promise<string | null> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    return null;
  }
  const directoryUri = `${baseDir}${LOCAL_FILES_DIR_NAME}/`;
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }
  return directoryUri;
}

async function readPickedTextAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (asset.file) {
      return asset.file.text();
    }
    const response = await fetch(asset.uri);
    return response.text();
  }
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export const [NotesProvider, useNotes] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [syncedNotes, setSyncedNotes] = useState<Note[]>([]);
  const [localFileNotes, setLocalFileNotes] = useState<Note[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    showLineNumbers: false,
    cookieAccepted: false,
  });
  const [favoriteSyncedNoteIds, setFavoriteSyncedNoteIds] = useState<string[]>([]);
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
          storageType: 'synced' as const,
          isFavorite: favoriteSyncedNoteIds.includes(row.id),
        }));
      }
      const stored = await AsyncStorage.getItem(NOTES_KEY);
      const parsed = stored ? (JSON.parse(stored) as Note[]) : [];
      return parsed.map((note) => ({
        ...note,
        storageType: 'synced' as const,
        isFavorite: note.isFavorite ?? false,
      }));
    },
    enabled: !auth.isLoading,
  });

  const favoriteSyncedIdsQuery = useQuery({
    queryKey: ['favoriteSyncedNoteIds'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(FAVORITE_SYNCED_NOTE_IDS_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    },
  });

  const localFilesQuery = useQuery({
    queryKey: ['localFiles'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LOCAL_FILES_KEY);
      const parsed = stored ? (JSON.parse(stored) as Note[]) : [];
      return parsed.map((note) => ({
        ...note,
        storageType: 'local' as const,
        isFavorite: note.isFavorite ?? false,
      }));
    },
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
      setSyncedNotes(notesQuery.data);
    }
  }, [notesQuery.data]);

  useEffect(() => {
    if (favoriteSyncedIdsQuery.data) {
      setFavoriteSyncedNoteIds(favoriteSyncedIdsQuery.data);
    }
  }, [favoriteSyncedIdsQuery.data]);

  useEffect(() => {
    setSyncedNotes((prev) =>
      prev.map((note) => ({
        ...note,
        isFavorite: favoriteSyncedNoteIds.includes(note.id),
      }))
    );
  }, [favoriteSyncedNoteIds]);

  useEffect(() => {
    if (localFilesQuery.data) {
      setLocalFileNotes(localFilesQuery.data);
    }
  }, [localFilesQuery.data]);

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

  const persistSyncedNotes = useMutation({
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
      void queryClient.invalidateQueries({ queryKey: ['notes', auth.session?.user?.id ?? 'local'] });
    },
  });

  const persistLocalFiles = useMutation({
    mutationFn: async (updated: Note[]) => {
      await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['localFiles'] });
    },
  });

  const persistFavoriteSyncedIds = useMutation({
    mutationFn: async (updated: string[]) => {
      await AsyncStorage.setItem(FAVORITE_SYNCED_NOTE_IDS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favoriteSyncedNoteIds'] });
    },
  });

  const persistSettings = useMutation({
    mutationFn: async (updated: Settings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const notes = useMemo(() => {
    return [...localFileNotes, ...syncedNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [localFileNotes, syncedNotes]);

  const notesCreatedToday = useMemo(() => {
    const today = getDateKey(new Date().toISOString());
    return syncedNotes.filter((note) => getDateKey(note.createdAt) === today).length;
  }, [syncedNotes]);

  const canCreateNote = notesCreatedToday < MAX_DAILY_NOTES;

  const addNote = useCallback((): Note | null => {
    if (!canCreateNote) {
      return null;
    }
    const now = new Date();
    const note: Note = {
      id: generateId(),
      title: `Nota ${formatDateTime(now)}`,
      content: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      storageType: 'synced',
      isFavorite: false,
    };
    const updated = [note, ...syncedNotes];
    setSyncedNotes(updated);
    persistSyncedNotes.mutate(updated);

    if (openTabIds.length < MAX_OPEN_TABS) {
      setOpenTabIds((prev) => [...prev, note.id]);
    }
    setActiveTabId(note.id);
    console.log('Created synced note:', note.id);
    return note;
  }, [canCreateNote, syncedNotes, persistSyncedNotes, openTabIds.length]);

  const importLocalTextFile = useCallback(async (): Promise<Note | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        console.log('Local TXT import cancelled');
        return null;
      }

      const asset = result.assets[0];
      const content = await readPickedTextAsset(asset);
      const now = new Date().toISOString();
      const title = getFileTitle(asset.name);
      let localFileUri: string | undefined;

      if (Platform.OS !== 'web') {
        const directoryUri = await ensureLocalFilesDirectory();
        if (!directoryUri) {
          throw new Error('documentDirectory no disponible');
        }
        localFileUri = `${directoryUri}${generateId()}-${sanitizeFileName(title)}.txt`;
        await FileSystem.writeAsStringAsync(localFileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const note: Note = {
        id: generateId(),
        title,
        content,
        createdAt: now,
        updatedAt: now,
        storageType: 'local',
        isFavorite: false,
        localFileUri,
      };
      const updated = [note, ...localFileNotes];
      setLocalFileNotes(updated);
      persistLocalFiles.mutate(updated);
      setOpenTabIds((prev) => (prev.includes(note.id) ? prev : [...prev.slice(-(MAX_OPEN_TABS - 1)), note.id]));
      setActiveTabId(note.id);
      console.log('Imported local TXT file:', asset.name, 'as note:', note.id);
      return note;
    } catch (error) {
      console.log('Local TXT import error:', error);
      Alert.alert('Error', 'No se pudo abrir el archivo .txt local.');
      return null;
    }
  }, [localFileNotes, persistLocalFiles]);

  const saveNoteAsLocalFile = useCallback(
    async (id: string): Promise<Note | null> => {
      const sourceNote = [...localFileNotes, ...syncedNotes].find((note) => note.id === id);
      if (!sourceNote) {
        return null;
      }

      const safeFileName = `${sanitizeFileName(sourceNote.title)}.txt`;

      try {
        if (Platform.OS === 'web') {
          triggerWebDownload(safeFileName, sourceNote.content);
          if (sourceNote.storageType === 'local') {
            console.log('Downloaded existing local TXT on web:', sourceNote.id);
            Alert.alert('Archivo guardado', 'Se descargó el archivo .txt local.');
            return sourceNote;
          }

          const now = new Date().toISOString();
          const localCopy: Note = {
            ...sourceNote,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
            storageType: 'local',
          };
          const updated = [localCopy, ...localFileNotes];
          setLocalFileNotes(updated);
          persistLocalFiles.mutate(updated);
          console.log('Created local TXT copy on web:', localCopy.id);
          Alert.alert('Archivo guardado', 'Se creó una copia local del .txt y se descargó al dispositivo.');
          return localCopy;
        }

        const directoryUri = await ensureLocalFilesDirectory();
        if (!directoryUri) {
          throw new Error('documentDirectory no disponible');
        }

        if (sourceNote.storageType === 'local') {
          const targetUri = sourceNote.localFileUri ?? `${directoryUri}${generateId()}-${safeFileName}`;
          await FileSystem.writeAsStringAsync(targetUri, sourceNote.content, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          const updatedLocalNote: Note = {
            ...sourceNote,
            localFileUri: targetUri,
            updatedAt: new Date().toISOString(),
          };
          const updated = localFileNotes.map((note) => (note.id === sourceNote.id ? updatedLocalNote : note));
          setLocalFileNotes(updated);
          persistLocalFiles.mutate(updated);
          console.log('Saved local TXT note to device file:', targetUri);
          Alert.alert('Archivo guardado', 'El archivo .txt local se actualizó en el dispositivo.');
          return updatedLocalNote;
        }

        const localFileUri = `${directoryUri}${generateId()}-${safeFileName}`;
        await FileSystem.writeAsStringAsync(localFileUri, sourceNote.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const now = new Date().toISOString();
        const localCopy: Note = {
          ...sourceNote,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          storageType: 'local',
          localFileUri,
        };
        const updated = [localCopy, ...localFileNotes];
        setLocalFileNotes(updated);
        persistLocalFiles.mutate(updated);
        console.log('Created local TXT copy from synced note:', localFileUri, 'new note:', localCopy.id);
        Alert.alert('Archivo guardado', 'Se creó una copia local .txt en el dispositivo.');
        return localCopy;
      } catch (error) {
        console.log('Save note as local TXT error:', error);
        Alert.alert('Error', 'No se pudo guardar el archivo .txt local.');
        return null;
      }
    },
    [localFileNotes, syncedNotes, persistLocalFiles]
  );

  const updateNote = useCallback(
    (id: string, changes: Partial<Pick<Note, 'title' | 'content'>>) => {
      const localTarget = localFileNotes.find((note) => note.id === id);
      if (localTarget) {
        const updatedLocalNotes = localFileNotes.map((note) =>
          note.id === id ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note
        );
        const updatedLocalNote = updatedLocalNotes.find((note) => note.id === id);
        setLocalFileNotes(updatedLocalNotes);
        persistLocalFiles.mutate(updatedLocalNotes);

        if (Platform.OS !== 'web' && updatedLocalNote?.localFileUri && typeof changes.content === 'string') {
          FileSystem.writeAsStringAsync(updatedLocalNote.localFileUri, updatedLocalNote.content, {
            encoding: FileSystem.EncodingType.UTF8,
          }).then(() => {
            console.log('Persisted local TXT change to device file:', updatedLocalNote.localFileUri);
          }).catch((error: unknown) => {
            console.log('Persist local TXT file write error:', error);
          });
        }
        return;
      }

      const updatedSyncedNotes = syncedNotes.map((note) =>
        note.id === id ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note
      );
      setSyncedNotes(updatedSyncedNotes);
      persistSyncedNotes.mutate(updatedSyncedNotes);
    },
    [localFileNotes, syncedNotes, persistLocalFiles, persistSyncedNotes]
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

  const toggleFavorite = useCallback(
    (id: string) => {
      const localTarget = localFileNotes.find((note) => note.id === id);
      if (localTarget) {
        const updatedLocalNotes = localFileNotes.map((note) =>
          note.id === id ? { ...note, isFavorite: !note.isFavorite, updatedAt: new Date().toISOString() } : note
        );
        setLocalFileNotes(updatedLocalNotes);
        persistLocalFiles.mutate(updatedLocalNotes);
        return;
      }

      const updatedSyncedNotes = syncedNotes.map((note) =>
        note.id === id ? { ...note, isFavorite: !note.isFavorite, updatedAt: new Date().toISOString() } : note
      );
      const nextFavoriteIds = updatedSyncedNotes.filter((note) => note.isFavorite).map((note) => note.id);
      setSyncedNotes(updatedSyncedNotes);
      setFavoriteSyncedNoteIds(nextFavoriteIds);
      persistFavoriteSyncedIds.mutate(nextFavoriteIds);
      persistSyncedNotes.mutate(updatedSyncedNotes);
    },
    [localFileNotes, syncedNotes, persistLocalFiles, persistFavoriteSyncedIds, persistSyncedNotes]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const localTarget = localFileNotes.find((note) => note.id === id);
      if (localTarget) {
        const updatedLocalNotes = localFileNotes.filter((note) => note.id !== id);
        setLocalFileNotes(updatedLocalNotes);
        persistLocalFiles.mutate(updatedLocalNotes);
        if (Platform.OS !== 'web' && localTarget.localFileUri) {
          FileSystem.deleteAsync(localTarget.localFileUri, { idempotent: true }).catch((error: unknown) => {
            console.log('Local TXT delete file error:', error);
          });
        }
      } else {
        const updatedSyncedNotes = syncedNotes.filter((note) => note.id !== id);
        const nextFavoriteIds = favoriteSyncedNoteIds.filter((noteId) => noteId !== id);
        setSyncedNotes(updatedSyncedNotes);
        setFavoriteSyncedNoteIds(nextFavoriteIds);
        persistFavoriteSyncedIds.mutate(nextFavoriteIds);
        persistSyncedNotes.mutate(updatedSyncedNotes);
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
      }

      setOpenTabIds((prev) => prev.filter((tabId) => tabId !== id));
      if (activeTabId === id) {
        setActiveTabId(openTabIds.find((tabId) => tabId !== id) ?? null);
      }
    },
    [localFileNotes, syncedNotes, persistLocalFiles, persistFavoriteSyncedIds, persistSyncedNotes, auth.session?.user?.id, activeTabId, openTabIds, favoriteSyncedNoteIds]
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
      const newTabs = openTabIds.filter((tabId) => tabId !== id);
      setOpenTabIds(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
      }
    },
    [openTabIds, activeTabId]
  );

  const getNotesForDate = useCallback(
    (dateStr: string): Note[] => {
      return notes.filter((note) => getDateKey(note.createdAt) === dateStr);
    },
    [notes]
  );

  const getDatesWithNotes = useMemo(() => {
    const dates = new Set<string>();
    notes.forEach((note) => dates.add(getDateKey(note.createdAt)));
    return dates;
  }, [notes]);

  const searchNotes = useCallback(
    (query: string, startDate?: string, endDate?: string): Note[] => {
      const loweredQuery = query.toLowerCase();
      return notes.filter((note) => {
        const matchesQuery =
          !query || note.title.toLowerCase().includes(loweredQuery) || note.content.toLowerCase().includes(loweredQuery);
        const noteDate = getDateKey(note.createdAt);
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
    (id: string): Note | undefined => notes.find((note) => note.id === id),
    [notes]
  );

  return useMemo(
    () => ({
      notes,
      openTabIds,
      activeTabId,
      settings,
      canCreateNote,
      notesCreatedToday,
      isLoading: notesQuery.isLoading || favoriteSyncedIdsQuery.isLoading || localFilesQuery.isLoading || auth.isLoading,
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
      importLocalTextFile,
      saveNoteAsLocalFile,
      toggleFavorite,
    }),
    [
      notes,
      openTabIds,
      activeTabId,
      settings,
      canCreateNote,
      notesCreatedToday,
      notesQuery.isLoading,
      favoriteSyncedIdsQuery.isLoading,
      localFilesQuery.isLoading,
      auth,
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
      email,
      password,
      setEmail,
      setPassword,
      signUp,
      signIn,
      signOut,
      signUpCooldownUntil,
      importLocalTextFile,
      saveNoteAsLocalFile,
      toggleFavorite,
    ]
  );
});
