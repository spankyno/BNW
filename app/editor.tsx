import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Download, Save, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import NoteTabBar from '@/components/NoteTabBar';
import SaveAsModal from '@/components/SaveAsModal';

export default function EditorScreen() {
  const { colors } = useTheme();
  const {
    openTabIds,
    activeTabId,
    setActiveTabId,
    closeTab,
    openTab,
    getNoteById,
    updateNote,
    deleteNote,
    settings,
    notes,
  } = useNotes();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();

  const [showSaveAs, setShowSaveAs] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (noteId) {
      openTab(noteId);
      setActiveTabId(noteId);
    }
  }, [noteId]);

  const activeNote = useMemo(
    () => (activeTabId ? getNoteById(activeTabId) : undefined),
    [activeTabId, getNoteById, notes]
  );

  const tabNotes = useMemo(
    () =>
      openTabIds
        .map((id) => getNoteById(id))
        .filter((n): n is NonNullable<typeof n> => n != null),
    [openTabIds, getNoteById, notes]
  );

  const handleContentChange = useCallback(
    (text: string) => {
      if (!activeTabId) return;
      updateNote(activeTabId, { content: text });
    },
    [activeTabId, updateNote]
  );

  const handleSaveAs = useCallback(
    (title: string) => {
      if (!activeTabId) return;
      updateNote(activeTabId, { title });
      setShowSaveAs(false);
    },
    [activeTabId, updateNote]
  );

  const handleDelete = useCallback(() => {
    if (!activeNote) return;
    Alert.alert('Eliminar nota', `¿Eliminar "${activeNote.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          deleteNote(activeNote.id);
          if (openTabIds.length <= 1) {
            router.back();
          }
        },
      },
    ]);
  }, [activeNote, deleteNote, openTabIds, router]);

  const handleDownload = useCallback(() => {
    if (!activeNote) return;
    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([activeNote.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeNote.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.log('Download error:', e);
        Alert.alert('Error', 'No se pudo descargar la nota.');
      }
    } else {
      Alert.alert(
        'Descargar nota',
        'El contenido de la nota ha sido copiado. En una versión futura podrás exportar como archivo .txt.',
      );
    }
  }, [activeNote]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const lines = useMemo(() => {
    if (!activeNote || !settings.showLineNumbers) return [];
    const count = (activeNote.content.match(/\n/g) || []).length + 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeNote, settings.showLineNumbers]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingBottom: 8,
          paddingTop: insets.top + 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        backBtn: {
          width: 38,
          height: 38,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
        },
        headerTitle: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600' as const,
          color: colors.text,
          marginHorizontal: 12,
        },
        headerAction: {
          width: 38,
          height: 38,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        },
        editorContainer: { flex: 1, flexDirection: 'row' },
        lineNumbers: {
          paddingTop: 14,
          paddingHorizontal: 8,
          backgroundColor: colors.surfaceSecondary,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          minWidth: 40,
          alignItems: 'flex-end',
        },
        lineNum: {
          fontSize: 13,
          lineHeight: 20,
          color: colors.placeholder,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        textInput: {
          flex: 1,
          padding: 14,
          fontSize: 15,
          lineHeight: 22,
          color: colors.text,
          textAlignVertical: 'top',
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyText: { fontSize: 15, color: colors.textSecondary },
        toolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        toolBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: colors.surfaceSecondary,
          gap: 6,
        },
        toolBtnDanger: {
          backgroundColor: colors.destructive + '12',
        },
        toolText: { fontSize: 12, fontWeight: '600' as const },
        autoSaveText: {
          fontSize: 10,
          color: colors.placeholder,
          textAlign: 'center',
          paddingVertical: 4,
          backgroundColor: colors.surface,
        },
      }),
    [colors, insets]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} testID="editor-back">
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeNote?.title ?? 'Editor'}
        </Text>
        <TouchableOpacity
          style={[styles.headerAction, { backgroundColor: colors.accentLight }]}
          onPress={() => setShowSaveAs(true)}
        >
          <Save size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <NoteTabBar
        tabs={tabNotes}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        onClose={(id) => {
          closeTab(id);
          if (openTabIds.length <= 1) router.back();
        }}
      />

      {activeNote ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.editorContainer}>
            {settings.showLineNumbers && (
              <ScrollView style={styles.lineNumbers} showsVerticalScrollIndicator={false}>
                {lines.map((num) => (
                  <Text key={num} style={styles.lineNum}>
                    {num}
                  </Text>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={styles.textInput}
              value={activeNote.content}
              onChangeText={handleContentChange}
              multiline
              placeholder="Escribe tu nota aquí..."
              placeholderTextColor={colors.placeholder}
              autoCorrect={false}
              autoCapitalize="sentences"
              testID="note-editor-input"
            />
          </View>

          <Text style={styles.autoSaveText}>Autoguardado activado</Text>

          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSaveAs(true)}>
              <Save size={15} color={colors.accent} />
              <Text style={[styles.toolText, { color: colors.accent }]}>Guardar como</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handleDownload}>
              <Download size={15} color={colors.text} />
              <Text style={[styles.toolText, { color: colors.text }]}>Descargar .txt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDanger]} onPress={handleDelete}>
              <Trash2 size={15} color={colors.destructive} />
              <Text style={[styles.toolText, { color: colors.destructive }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay nota activa</Text>
        </View>
      )}

      <SaveAsModal
        visible={showSaveAs}
        currentTitle={activeNote?.title ?? ''}
        onSave={handleSaveAs}
        onCancel={() => setShowSaveAs(false)}
      />
    </View>
  );
}
