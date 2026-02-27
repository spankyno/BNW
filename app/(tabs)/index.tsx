import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, FileText, Trash2, Heart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import CookieBanner from '@/components/CookieBanner';
import { Note } from '@/types/notes';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${min}`;
}

function getPreview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Nota vacía';
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed;
}

export default function NotesListScreen() {
  const { colors } = useTheme();
  const {
    notes,
    isLoading,
    canCreateNote,
    notesCreatedToday,
    addNote,
    deleteNote,
    toggleFavorite,
    openTab,
    settings,
    acceptCookie,
  } = useNotes();
  const router = useRouter();

  const handleCreateNote = useCallback(() => {
    if (!canCreateNote) {
      Alert.alert(
        'Límite diario',
        `Has alcanzado el máximo de 10 notas por día. (${notesCreatedToday}/10)`,
      );
      return;
    }
    const note = addNote();
    if (note) {
      router.push({ pathname: '/editor' as any, params: { noteId: note.id } });
    }
  }, [canCreateNote, notesCreatedToday, addNote, openTab, router]);

  const handleOpenNote = useCallback(
    (id: string) => {
      openTab(id);
      router.push({ pathname: '/editor' as any, params: { noteId: id } });
    },
    [openTab, router]
  );

  const handleDeleteNote = useCallback(
    (note: Note) => {
      Alert.alert('Eliminar nota', `¿Eliminar "${note.title}"?`, [
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
        listContent: { padding: 16, paddingBottom: 100 },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 16,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardIcon: {
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        cardContent: { flex: 1 },
        cardTitle: {
          fontSize: 15,
          fontWeight: '600' as const,
          color: colors.text,
          marginBottom: 2,
        },
        cardPreview: {
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: 4,
          lineHeight: 18,
        },
        cardDate: { fontSize: 11, color: colors.placeholder },
        rightActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginLeft: 8,
        },
        favoriteBtn: {
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FF3B3018',
        },
        deleteBtn: {
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.destructive + '12',
        },
        fab: {
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        },
        emptyContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 80,
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '700' as const,
          color: colors.text,
          marginBottom: 6,
        },
        emptyDesc: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          paddingHorizontal: 40,
          lineHeight: 20,
        },
        counter: {
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: 'center',
          paddingVertical: 8,
        },
        loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: Note }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenNote(item.id)}
        activeOpacity={0.7}
        testID={`note-card-${item.id}`}
      >
        <View style={styles.cardIcon}>
          <FileText size={18} color={colors.accent} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardPreview} numberOfLines={1}>
            {getPreview(item.content)}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.updatedAt)}</Text>
        </View>
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`favorite-note-${item.id}`}
          >
            <Heart
              size={16}
              color="#FF3B30"
              fill={item.isFavorite ? '#FF3B30' : 'transparent'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteNote(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`delete-note-${item.id}`}
          >
            <Trash2 size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [styles, colors, handleOpenNote, handleDeleteNote, toggleFavorite]
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
          notes.length > 0 ? (
            <Text style={styles.counter}>
              {notesCreatedToday}/10 notas creadas hoy
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FileText size={28} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Sin notas aún</Text>
            <Text style={styles.emptyDesc}>
              Toca el botón + para crear tu primera nota
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateNote}
        activeOpacity={0.85}
        testID="create-note-fab"
      >
        <Plus size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {!settings.cookieAccepted && <CookieBanner onAccept={acceptCookie} />}
    </View>
  );
}
