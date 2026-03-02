import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { ArrowLeft, Download, Save, Trash2, Archive, ZoomIn, ZoomOut } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import NoteTabBar from '@/components/NoteTabBar';
import SaveAsModal from '@/components/SaveAsModal';

function sanitizeFileName(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'nota';
}

function formatDateForFile(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${h}${min}${sec}`;
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const BASE_FONT_SIZE = 15;
const BASE_LINE_HEIGHT = 22;
const BASE_LINE_NUMBER_SIZE = 13;
const BASE_LINE_NUMBER_HEIGHT = 20;

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

  const [showSaveAs, setShowSaveAs] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);

  useEffect(() => {
    if (noteId) {
      openTab(noteId);
      setActiveTabId(noteId);
    }
  }, [noteId, openTab, setActiveTabId]);

  const activeNote = useMemo(
    () => (activeTabId ? getNoteById(activeTabId) : undefined),
    [activeTabId, getNoteById]
  );

  const tabNotes = useMemo(
    () =>
      openTabIds
        .map((id) => getNoteById(id))
        .filter((n): n is NonNullable<typeof n> => n != null),
    [openTabIds, getNoteById]
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

  const handleDownload = useCallback(async () => {
    if (!activeNote) {
      return;
    }

    const fileName = `${sanitizeFileName(activeNote.title)}.txt`;

    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([activeNote.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('TXT downloaded on web:', fileName);
      } catch (error) {
        console.log('TXT download error on web:', error);
        Alert.alert('Error', 'No se pudo descargar la nota.');
      }
      return;
    }

    try {
      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error('documentDirectory no disponible');
      }
      const outputPath = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(outputPath, activeNote.content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      console.log('TXT saved in local filesystem:', outputPath);
      Alert.alert('Descarga completada', `Nota guardada en:\n${outputPath}`);
    } catch (error) {
      console.log('TXT save error on native:', error);
      Alert.alert('Error', 'No se pudo guardar el archivo .txt en el dispositivo.');
    }
  }, [activeNote]);

  const handleDownloadAll = useCallback(async () => {
    if (notes.length === 0) {
      Alert.alert('Sin notas', 'No hay notas para exportar.');
      return;
    }

    const backupName = `backup-notas-${formatDateForFile(new Date())}.zip`;

    if (Platform.OS === 'web') {
      try {
        const zip = new JSZip();
        notes.forEach((note) => {
          const safeName = sanitizeFileName(note.title);
          zip.file(`${safeName}-${note.id.slice(0, 6)}.txt`, note.content);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('ZIP backup downloaded on web:', backupName, 'notes:', notes.length);
      } catch (error) {
        console.log('ZIP backup error on web:', error);
        Alert.alert('Error', 'No se pudo descargar la copia de seguridad en .zip.');
      }
      return;
    }

    try {
      const zip = new JSZip();
      notes.forEach((note) => {
        const safeName = sanitizeFileName(note.title);
        zip.file(`${safeName}-${note.id.slice(0, 6)}.txt`, note.content);
      });

      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error('documentDirectory no disponible');
      }
      const outputPath = `${baseDir}${backupName}`;
      await FileSystem.writeAsStringAsync(outputPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('ZIP backup saved in local filesystem:', outputPath, 'notes:', notes.length);
      Alert.alert('Copia de seguridad creada', `Archivo guardado en:\n${outputPath}`);
    } catch (error) {
      console.log('ZIP backup save error on native:', error);
      Alert.alert('Error', 'No se pudo guardar la copia de seguridad .zip.');
    }
  }, [notes]);

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Number(Math.min(MAX_ZOOM, prev + ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Number(Math.max(MIN_ZOOM, prev - ZOOM_STEP).toFixed(2)));
  }, []);

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
          fontSize: BASE_LINE_NUMBER_SIZE * zoomScale,
          lineHeight: BASE_LINE_NUMBER_HEIGHT * zoomScale,
          color: colors.placeholder,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        textInput: {
          flex: 1,
          padding: 14,
          fontSize: BASE_FONT_SIZE * zoomScale,
          lineHeight: BASE_LINE_HEIGHT * zoomScale,
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
        zoomControlWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        zoomBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
        },
        zoomText: {
          minWidth: 56,
          textAlign: 'center',
          color: colors.textSecondary,
          fontWeight: '700' as const,
          fontSize: 12,
        },
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
          paddingHorizontal: 10,
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
    [colors, insets, zoomScale]
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
          testID="save-note-top"
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

          <View style={styles.zoomControlWrap}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomOut}
              disabled={zoomScale <= MIN_ZOOM}
              testID="zoom-out"
            >
              <ZoomOut size={16} color={zoomScale <= MIN_ZOOM ? colors.placeholder : colors.text} />
            </TouchableOpacity>
            <Text style={styles.zoomText} testID="zoom-value">
              {Math.round(zoomScale * 100)}%
            </Text>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomIn}
              disabled={zoomScale >= MAX_ZOOM}
              testID="zoom-in"
            >
              <ZoomIn size={16} color={zoomScale >= MAX_ZOOM ? colors.placeholder : colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSaveAs(true)} testID="save-as-btn">
              <Save size={15} color={colors.accent} />
              <Text style={[styles.toolText, { color: colors.accent }]}>Guardar como</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handleDownload} testID="download-txt-btn">
              <Download size={15} color={colors.text} />
              <Text style={[styles.toolText, { color: colors.text }]}>Descargar .txt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handleDownloadAll} testID="download-zip-btn">
              <Archive size={15} color={colors.text} />
              <Text style={[styles.toolText, { color: colors.text }]}>Backup .zip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, styles.toolBtnDanger]}
              onPress={handleDelete}
              testID="delete-note-btn"
            >
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

