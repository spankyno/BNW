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
  NativeSyntheticEvent,
  TextInputScrollEventData,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Download, Save, Trash2, ZoomIn, ZoomOut, Cloud, HardDrive } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';
import NoteTabBar from '@/components/NoteTabBar';
import SaveAsModal from '@/components/SaveAsModal';

function sanitizeFileName(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'nota';
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const BASE_FONT_SIZE = 15;
const BASE_LINE_HEIGHT = 22;
const BASE_LINE_NUMBER_SIZE = 13;
const BASE_LINE_NUMBER_HEIGHT = 20;
const SAVE_DEBOUNCE_MS = 2000;

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
    saveNoteAsLocalFile,
  } = useNotes();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const lineNumbersRef = useRef<ScrollView | null>(null);
  const lastSavedContentRef = useRef<string>('');

  const [showSaveAs, setShowSaveAs] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [draftContent, setDraftContent] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

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
        .filter((note): note is NonNullable<typeof note> => note != null),
    [openTabIds, getNoteById]
  );

  useEffect(() => {
    if (!activeNote) {
      setDraftContent('');
      setIsTyping(false);
      lastSavedContentRef.current = '';
      return;
    }
    setDraftContent(activeNote.content);
    setIsTyping(false);
    lastSavedContentRef.current = activeNote.content;
  }, [activeNote]);

  useEffect(() => {
    if (!activeTabId || !activeNote) {
      return;
    }
    if (draftContent === lastSavedContentRef.current) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    const timeout = setTimeout(() => {
      updateNote(activeTabId, { content: draftContent });
      lastSavedContentRef.current = draftContent;
      setIsTyping(false);
      console.log('Debounced autosave persisted:', activeTabId, 'length:', draftContent.length);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [activeTabId, activeNote, draftContent, updateNote]);

  const handleContentChange = useCallback((text: string) => {
    setDraftContent(text);
    setIsTyping(text !== lastSavedContentRef.current);
  }, []);

  const handleSaveAs = useCallback(
    (title: string) => {
      if (!activeTabId) {
        return;
      }
      updateNote(activeTabId, { title });
      setShowSaveAs(false);
    },
    [activeTabId, updateNote]
  );

  const handleDelete = useCallback(() => {
    if (!activeNote) {
      return;
    }
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
  }, [activeNote, deleteNote, openTabIds.length, router]);

  const handleDownload = useCallback(async () => {
    if (!activeNote) {
      return;
    }

    const fileName = `${sanitizeFileName(activeNote.title)}.txt`;

    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([draftContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        console.log('TXT downloaded on web:', fileName);
      } catch (error) {
        console.log('TXT download error on web:', error);
        Alert.alert('Error', 'No se pudo descargar la nota.');
      }
      return;
    }

    try {
      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted || !permissions.directoryUri) {
          Alert.alert('Permiso requerido', 'Debes seleccionar la carpeta Descargas para guardar el archivo.');
          return;
        }

        const pickedUri = permissions.directoryUri.toLowerCase();
        if (!pickedUri.includes('download')) {
          Alert.alert('Carpeta incorrecta', 'Selecciona la carpeta Descargas para guardar el .txt.');
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'text/plain'
        );
        await FileSystem.writeAsStringAsync(fileUri, draftContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        console.log('TXT saved in Android Downloads via SAF:', fileUri);
        Alert.alert('Descarga completada', 'Archivo .txt guardado en Descargas.');
        return;
      }

      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error('documentDirectory no disponible');
      }
      const outputPath = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(outputPath, draftContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      console.log('TXT saved in app local filesystem:', outputPath);
      Alert.alert('Guardado local', `En iOS se guardó dentro del almacenamiento de la app:\n${outputPath}`);
    } catch (error) {
      console.log('TXT save error on native:', error);
      Alert.alert('Error', 'No se pudo guardar el archivo .txt en el dispositivo.');
    }
  }, [activeNote, draftContent]);

  const handleSaveLocalFile = useCallback(async () => {
    if (!activeTabId) {
      return;
    }
    if (draftContent !== lastSavedContentRef.current) {
      updateNote(activeTabId, { content: draftContent });
      lastSavedContentRef.current = draftContent;
      setIsTyping(false);
    }
    const savedNote = await saveNoteAsLocalFile(activeTabId);
    if (savedNote && savedNote.id !== activeTabId) {
      openTab(savedNote.id);
      setActiveTabId(savedNote.id);
      router.replace({ pathname: '/editor' as never, params: { noteId: savedNote.id } as never });
    }
  }, [activeTabId, draftContent, saveNoteAsLocalFile, updateNote, openTab, setActiveTabId, router]);

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Number(Math.min(MAX_ZOOM, prev + ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Number(Math.max(MIN_ZOOM, prev - ZOOM_STEP).toFixed(2)));
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEditorScroll = useCallback((event: NativeSyntheticEvent<TextInputScrollEventData>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    lineNumbersRef.current?.scrollTo({ y: offsetY, animated: false });
  }, []);

  const lines = useMemo(() => {
    if (!activeNote || !settings.showLineNumbers) {
      return [];
    }
    const count = (draftContent.match(/\n/g) || []).length + 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [activeNote, draftContent, settings.showLineNumbers]);

  const storageMeta = useMemo(() => {
    if (!activeNote) {
      return { label: 'Editor', icon: null };
    }
    if (activeNote.storageType === 'local') {
      return {
        label: 'Archivo local',
        icon: <HardDrive size={14} color={colors.textSecondary} />,
      };
    }
    return {
      label: 'Nota sincronizada',
      icon: <Cloud size={14} color={colors.accent} />,
    };
  }, [activeNote, colors.accent, colors.textSecondary]);

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
        headerCenter: {
          flex: 1,
          marginHorizontal: 12,
        },
        headerTitle: {
          fontSize: 15,
          fontWeight: '700' as const,
          color: colors.text,
        },
        headerMeta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 3,
        },
        headerMetaText: {
          fontSize: 11,
          fontWeight: '600' as const,
          color: colors.textSecondary,
        },
        headerAction: {
          width: 38,
          height: 38,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        },
        editorShell: {
          flex: 1,
        },
        editorContainer: {
          flex: 1,
          flexDirection: 'row',
          backgroundColor: colors.surface,
        },
        lineNumbers: {
          paddingTop: 14,
          paddingHorizontal: 8,
          backgroundColor: colors.surfaceSecondary,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          minWidth: 42,
        },
        lineNum: {
          fontSize: BASE_LINE_NUMBER_SIZE * zoomScale,
          lineHeight: BASE_LINE_NUMBER_HEIGHT * zoomScale,
          color: colors.placeholder,
          textAlign: 'right',
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        inputWrap: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        textInput: {
          flex: 1,
          paddingTop: 14,
          paddingBottom: 18,
          paddingLeft: 14,
          paddingRight: 18,
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
        bottomPanel: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          gap: 8,
        },
        topControlRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        zoomControlWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
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
          justifyContent: 'space-between',
          gap: 8,
        },
        toolBtn: {
          flex: 1,
          minHeight: 42,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: colors.surfaceSecondary,
          gap: 6,
        },
        toolBtnDanger: {
          backgroundColor: colors.destructive + '12',
        },
        toolText: { fontSize: 11, fontWeight: '700' as const },
        autoSaveText: {
          fontSize: 12,
          color: colors.textSecondary,
          fontWeight: '600' as const,
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeNote?.title ?? 'Editor'}
          </Text>
          <View style={styles.headerMeta}>
            {storageMeta.icon}
            <Text style={styles.headerMetaText}>{storageMeta.label}</Text>
          </View>
        </View>
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
          if (openTabIds.length <= 1) {
            router.back();
          }
        }}
      />

      {activeNote ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.editorShell}>
            <View style={styles.editorContainer}>
              {settings.showLineNumbers && (
                <ScrollView
                  ref={lineNumbersRef}
                  style={styles.lineNumbers}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                >
                  {lines.map((num) => (
                    <Text key={num} style={styles.lineNum}>
                      {num}
                    </Text>
                  ))}
                </ScrollView>
              )}
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  value={draftContent}
                  onChangeText={handleContentChange}
                  onScroll={handleEditorScroll}
                  multiline
                  scrollEnabled
                  placeholder="Escribe tu nota aquí..."
                  placeholderTextColor={colors.placeholder}
                  selectionColor={colors.accent}
                  autoCorrect={false}
                  autoCapitalize="sentences"
                  testID="note-editor-input"
                />
              </View>
            </View>

            <View style={styles.bottomPanel}>
              <View style={styles.topControlRow}>
                <Text style={styles.autoSaveText} testID="autosave-status-text">
                  {isTyping ? 'Escribiendo…' : 'Guardado'}
                </Text>

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
              </View>

              <View style={styles.toolbar}>
                <TouchableOpacity style={styles.toolBtn} onPress={() => setShowSaveAs(true)} testID="save-as-btn">
                  <Save size={15} color={colors.accent} />
                  <Text style={[styles.toolText, { color: colors.accent }]}>Guardar como</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolBtn} onPress={handleSaveLocalFile} testID="save-local-txt-btn">
                  <HardDrive size={15} color={colors.text} />
                  <Text style={[styles.toolText, { color: colors.text }]}>Guardar local</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolBtn} onPress={handleDownload} testID="download-txt-btn">
                  <Download size={15} color={colors.text} />
                  <Text style={[styles.toolText, { color: colors.text }]}>Descargar .txt</Text>
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
            </View>
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
