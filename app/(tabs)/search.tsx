import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, FileText, Filter, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import { Note } from '@/types/notes';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

function getPreview(content: string, query: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Nota vacía';
  if (query) {
    const idx = trimmed.toLowerCase().indexOf(query.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(trimmed.length, idx + query.length + 40);
      return (start > 0 ? '...' : '') + trimmed.slice(start, end) + (end < trimmed.length ? '...' : '');
    }
  }
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed;
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const { searchNotes, openTab } = useNotes();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(
    () => searchNotes(query, startDate || undefined, endDate || undefined),
    [query, startDate, endDate, searchNotes]
  );

  const handleOpenNote = useCallback(
    (id: string) => {
      openTab(id);
      router.push({ pathname: '/editor' as any, params: { noteId: id } });
    },
    [openTab, router]
  );

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setShowFilters(false);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        searchWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          marginHorizontal: 16,
          marginTop: 12,
          borderRadius: 12,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 10,
          fontSize: 15,
          color: colors.text,
        },
        filterBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: showFilters ? colors.accentLight : 'transparent',
        },
        filtersRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 10,
          gap: 8,
        },
        dateInput: {
          flex: 1,
          backgroundColor: colors.inputBg,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 13,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        },
        dateSep: { fontSize: 13, color: colors.textSecondary },
        clearBtn: {
          width: 32,
          height: 32,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
        },
        resultCount: {
          fontSize: 12,
          color: colors.textSecondary,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 6,
        },
        noteItem: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        noteIcon: {
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        noteContent: { flex: 1 },
        noteTitle: { fontSize: 14, fontWeight: '600' as const, color: colors.text, marginBottom: 2 },
        notePreview: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
        noteDate: { fontSize: 11, color: colors.placeholder, marginTop: 2 },
        emptyWrap: { alignItems: 'center', paddingTop: 60 },
        emptyIcon: {
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        emptyTitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text, marginBottom: 4 },
        emptyDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
      }),
    [colors, showFilters]
  );

  const renderNote = useCallback(
    ({ item }: { item: Note }) => (
      <TouchableOpacity
        style={styles.noteItem}
        onPress={() => handleOpenNote(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.noteIcon}>
          <FileText size={16} color={colors.accent} />
        </View>
        <View style={styles.noteContent}>
          <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.notePreview} numberOfLines={2}>
            {getPreview(item.content, query)}
          </Text>
          <Text style={styles.noteDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    ),
    [styles, colors, query, handleOpenNote]
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchIcon size={18} color={colors.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar en notas..."
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          testID="search-input"
        />
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? colors.accent : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersRow}>
          <TextInput
            style={styles.dateInput}
            placeholder="Desde (YYYY-MM-DD)"
            placeholderTextColor={colors.placeholder}
            value={startDate}
            onChangeText={setStartDate}
          />
          <Text style={styles.dateSep}>—</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="Hasta (YYYY-MM-DD)"
            placeholderTextColor={colors.placeholder}
            value={endDate}
            onChangeText={setEndDate}
          />
          <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={results}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          query || startDate || endDate ? (
            <Text style={styles.resultCount}>
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <SearchIcon size={24} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>
              {query ? 'Sin resultados' : 'Buscar notas'}
            </Text>
            <Text style={styles.emptyDesc}>
              {query
                ? 'Intenta con otros términos o ajusta los filtros de fecha'
                : 'Escribe un término para buscar en todas tus notas'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
