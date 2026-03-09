import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, FileText, Trash2, Cloud, Save, FolderOpen, Heart, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import CookieBanner from '@/components/CookieBanner';
import { Note } from '@/types/notes';

function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function getPreview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Nota vacía';
  return trimmed.length > 88 ? `${trimmed.slice(0, 88)}...` : trimmed;
}

export default function NotesListScreen() {
  const { colors } = useTheme();
  const {
    notes,
    isLoading,
    canCreateNote,
    notesCreatedToday,
    addNote,
    createLocalNote,
    deleteNote,
    openTab,
    settings,
    acceptCookie,
    importLocalTextFile,
  } = useNotes();

  const syncedNotesCount = useMemo(() => notes.filter((note) => note.storageType === 'synced').length, [notes]);
  const localNotesCount = useMemo(() => notes.filter((note) => note.storageType === 'local').length, [notes]);
  const router = useRouter();
  const [isFabMenuOpen, setIsFabMenuOpen] = useState<boolean>(false);

  const handleCreateWebNote = useCallback(() => {
    if (!canCreateNote) {
      Alert.alert('Límite diario', `Has alcanzado el máximo de 10 notas por día. (${notesCreatedToday}/10)`);
      return;
    }

    const note = addNote();
    if (note) {
      setIsFabMenuOpen(false);
      router.push({ pathname: '/editor' as never, params: { noteId: note.id } as never });
    }
  }, [canCreateNote, notesCreatedToday, addNote, router]);

  const handleCreateLocalNote = useCallback(async () => {
    const localNote = await createLocalNote();
    if (localNote) {
      setIsFabMenuOpen(false);
      router.push({ pathname: '/editor' as never, params: { noteId: localNote.id } as never });
    }
  }, [createLocalNote, router]);

  const handleOpenLocalFile = useCallback(async () => {
    const localNote = await importLocalTextFile();
    if (localNote) {
      setIsFabMenuOpen(false);
      router.push({ pathname: '/editor' as never, params: { noteId: localNote.id } as never });
    }
  }, [importLocalTextFile, router]);

  const handleOpenNote = useCallback(
    (id: string) => {
      openTab(id);
      router.push({ pathname: '/editor' as never, params: { noteId: id } as never });
    },
    [openTab, router]
  );

  const handleDeleteNote = useCallback(
    (note: Note) => {
      const targetLabel = note.storageType === 'local' ? 'archivo local' : 'nota sincronizada';
      Alert.alert('Eliminar nota', `¿Eliminar "${note.title}" como ${targetLabel}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteNote(note.id) },
      ]);
    },
    [deleteNote]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        listContent: { padding: 16, paddingBottom: 110 },
        hero: {
          backgroundColor: colors.surface,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 18,
          marginBottom: 16,
        },
        heroEyebrow: {
          fontSize: 11,
          fontWeight: '700' as const,
          color: colors.accent,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        },
        heroTitle: {
          fontSize: 24,
          fontWeight: '800' as const,
          color: colors.text,
          marginBottom: 8,
        },
        heroText: {
          fontSize: 14,
          lineHeight: 21,
          color: colors.textSecondary,
          marginBottom: 6,
        },
        actionsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap' as const,
          gap: 10,
          marginTop: 14,
        },
        actionCard: {
          width: '31%',
          minWidth: 102,
          flexGrow: 1,
          borderRadius: 18,
          padding: 12,
          borderWidth: 1,
          minHeight: 120,
          justifyContent: 'space-between',
        },
        actionIcon: {
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        },
        actionTitle: {
          fontSize: 14,
          fontWeight: '700' as const,
          marginBottom: 4,
        },
        actionText: {
          fontSize: 11,
          lineHeight: 16,
          color: colors.textSecondary,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700' as const,
          color: colors.textSecondary,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.8,
          marginBottom: 10,
          marginLeft: 4,
        },
        counter: {
          fontSize: 12,
          color: colors.textSecondary,
          marginBottom: 12,
          paddingHorizontal: 4,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardIcon: {
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        cardContent: { flex: 1 },
        cardTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
        },
        favoriteIconWrap: {
          marginRight: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardTitle: {
          flex: 1,
          fontSize: 15,
          fontWeight: '700' as const,
          color: colors.text,
        },
        typeBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginLeft: 8,
        },
        typeBadgeText: {
          fontSize: 10,
          fontWeight: '700' as const,
        },
        cardPreview: {
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: 6,
          lineHeight: 18,
        },
        cardMeta: {
          fontSize: 11,
          color: colors.placeholder,
        },
        deleteBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.destructive}12`,
          marginLeft: 10,
        },
        fabBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: '#00000020',
        },
        fabMenu: {
          position: 'absolute',
          right: 20,
          bottom: 92,
          gap: 10,
          alignItems: 'flex-end',
        },
        fabMenuItem: {
          minWidth: 188,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 14,
          elevation: 8,
        },
        fabMenuItemText: {
          fontSize: 13,
          fontWeight: '700' as const,
          color: colors.text,
        },
        fab: {
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.32,
          shadowRadius: 10,
          elevation: 8,
        },
        emptyContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 80,
        },
        emptyIcon: {
          width: 70,
          height: 70,
          borderRadius: 22,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '800' as const,
          color: colors.text,
          marginBottom: 6,
        },
        emptyDesc: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center' as const,
          paddingHorizontal: 32,
          lineHeight: 20,
        },
        loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const isLocal = item.storageType === 'local';
      const badgeColor = isLocal ? colors.textSecondary : colors.accent;
      const badgeBackground = isLocal ? colors.surfaceSecondary : colors.accentLight;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleOpenNote(item.id)}
          activeOpacity={0.82}
          testID={`note-card-${item.id}`}
        >
          <View style={styles.cardIcon}>
            {isLocal ? <Save size={19} color={colors.text} /> : <Cloud size={19} color={colors.accent} />}
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              {item.isFavorite ? (
                <View style={styles.favoriteIconWrap}>
                  <Heart size={14} color="#E53935" fill="#E53935" />
                </View>
              ) : null}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: badgeBackground }]}>
                {isLocal ? <Save size={11} color={badgeColor} /> : <Cloud size={11} color={badgeColor} />}
                <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{isLocal ? 'Local' : 'Nube'}</Text>
              </View>
            </View>
            <Text style={styles.cardPreview} numberOfLines={2}>
              {getPreview(item.content)}
            </Text>
            <Text style={styles.cardMeta}>{formatDate(item.updatedAt)}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteNote(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`delete-note-${item.id}`}
          >
            <Trash2 size={16} color={colors.destructive} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [styles, colors, handleOpenNote, handleDeleteNote]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>Biblioteca</Text>
              <Text style={styles.heroTitle}>BNW - Bloc Notas Web</Text>
              <Text style={styles.heroText}>Nº Notas sincronizadas web: {syncedNotesCount}</Text>
              <Text style={styles.heroText}>Nº Notas en local: {localNotesCount}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.accentLight, borderColor: `${colors.accent}25` }]}
                  onPress={handleCreateLocalNote}
                  activeOpacity={0.88}
                  testID="create-local-note-card"
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                    <Save size={20} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={[styles.actionTitle, { color: colors.accent }]}>Nueva nota local</Text>
                    <Text style={styles.actionText}>Elige carpeta y crea el .txt en almacenamiento local.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={handleCreateWebNote}
                  activeOpacity={0.88}
                  testID="create-web-note-card"
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.surface }]}>
                    <Cloud size={20} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Nueva nota web</Text>
                    <Text style={styles.actionText}>Se sincroniza con el backend usando tu sistema actual.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={handleOpenLocalFile}
                  activeOpacity={0.88}
                  testID="open-local-txt-card"
                >
                  <View style={[styles.actionIcon, { backgroundColor: colors.surface }]}>
                    <FolderOpen size={20} color={colors.text} />
                  </View>
                  <View>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Abrir nota local</Text>
                    <Text style={styles.actionText}>Carga un archivo .txt existente desde el dispositivo.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Biblioteca</Text>
            {notes.length > 0 ? <Text style={styles.counter}>{notesCreatedToday}/10 notas sincronizadas creadas hoy</Text> : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FileText size={28} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Sin notas aún</Text>
            <Text style={styles.emptyDesc}>Crea una nota local, una nota web o abre un archivo .txt existente para empezar.</Text>
          </View>
        }
      />

      {isFabMenuOpen ? <Pressable style={styles.fabBackdrop} onPress={() => setIsFabMenuOpen(false)} testID="fab-menu-backdrop" /> : null}

      {isFabMenuOpen ? (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={handleCreateLocalNote} activeOpacity={0.88} testID="fab-create-local-note">
            <Text style={styles.fabMenuItemText}>Nueva nota local</Text>
            <Save size={16} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={handleCreateWebNote} activeOpacity={0.88} testID="fab-create-web-note">
            <Text style={styles.fabMenuItemText}>Nueva nota web</Text>
            <Cloud size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsFabMenuOpen((prev) => !prev)}
        activeOpacity={0.88}
        testID="create-note-fab"
      >
        {isFabMenuOpen ? <X size={24} color="#FFFFFF" /> : <Plus size={26} color="#FFFFFF" />}
      </TouchableOpacity>

      {!settings.cookieAccepted && <CookieBanner onAccept={acceptCookie} />}
    </View>
  );
}
