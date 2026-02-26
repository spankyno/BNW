import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, CalendarDays } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import CalendarGrid from '@/components/CalendarGrid';
import { Note } from '@/types/notes';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getPreview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Nota vacía';
  return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
}

function formatSelectedDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { getNotesForDate, getDatesWithNotes, openTab } = useNotes();
  const router = useRouter();

  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(today);

  const notesForDate = useMemo(
    () => getNotesForDate(selectedDate),
    [selectedDate, getNotesForDate]
  );

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
        calendarWrap: {
          backgroundColor: colors.surface,
          marginHorizontal: 16,
          marginTop: 16,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 10,
        },
        sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: colors.text },
        sectionCount: { fontSize: 13, color: colors.textSecondary },
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
        notePreview: { fontSize: 12, color: colors.textSecondary },
        noteTime: { fontSize: 11, color: colors.placeholder },
        emptyWrap: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 40 },
        emptyIcon: {
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: colors.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
      }),
    [colors]
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
          <Text style={styles.notePreview} numberOfLines={1}>{getPreview(item.content)}</Text>
        </View>
        <Text style={styles.noteTime}>{formatTime(item.createdAt)}</Text>
      </TouchableOpacity>
    ),
    [styles, colors, handleOpenNote]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notesForDate}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.calendarWrap}>
              <CalendarGrid
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                datesWithNotes={getDatesWithNotes}
              />
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {formatSelectedDate(selectedDate)}
              </Text>
              <Text style={styles.sectionCount}>
                {notesForDate.length} nota{notesForDate.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <CalendarDays size={22} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyText}>No hay notas para este día</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
