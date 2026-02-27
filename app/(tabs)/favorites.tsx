import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import { Note } from '@/types/notes';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getPreview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Nota vacía';
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed;
}

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { notes, openTab, toggleFavorite } = useNotes();
  const router = useRouter();

  const favorites = useMemo(() => notes.filter((note) => note.isFavorite), [notes]);

  const handleOpenNote = useCallback(
    (id: string) => {
      openTab(id);
      router.push({ pathname: '/editor' as any, params: { noteId: id } });
    },
    [openTab, router]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        listContent: { padding: 16, paddingBottom: 24 },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        iconWrap: {
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        content: { flex: 1 },
        title: {
          fontSize: 15,
          fontWeight: '600' as const,
          color: colors.text,
          marginBottom: 2,
        },
        preview: {
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 18,
        },
        date: {
          fontSize: 11,
          color: colors.placeholder,
          marginTop: 3,
        },
        heartBtn: {
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FF3B3018',
          marginLeft: 8,
        },
        emptyWrap: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 36 },
        emptyHeart: {
          width: 62,
          height: 62,
          borderRadius: 20,
          backgroundColor: colors.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        },
        emptyTitle: { fontSize: 17, fontWeight: '700' as const, color: colors.text, marginBottom: 6 },
        emptyDesc: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: Note }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenNote(item.id)}
        activeOpacity={0.7}
        testID={`favorite-card-${item.id}`}
      >
        <View style={styles.iconWrap}>
          <FileText size={17} color={colors.accent} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {getPreview(item.content)}
          </Text>
          <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggleFavorite(item.id)}
          testID={`unfavorite-note-${item.id}`}
        >
          <Heart size={16} color="#FF3B30" fill="#FF3B30" />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [styles, colors, handleOpenNote, toggleFavorite]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyHeart}>
              <Heart size={30} color="#FF3B30" />
            </View>
            <Text style={styles.emptyTitle}>Sin favoritos</Text>
            <Text style={styles.emptyDesc}>
              Marca una nota con el corazón rojo para verla aquí.
            </Text>
          </View>
        }
      />
    </View>
  );
}
