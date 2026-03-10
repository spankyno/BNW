import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SaveAsModalProps {
  visible: boolean;
  currentTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
  titleText?: string;
  subtitleText?: string;
  placeholderText?: string;
  confirmText?: string;
  testID?: string;
}

export default React.memo(function SaveAsModal({
  visible,
  currentTitle,
  onSave,
  onCancel,
  titleText = 'Guardar como',
  subtitleText = 'Escribe un nombre personalizado para tu nota',
  placeholderText = 'Nombre de la nota',
  confirmText = 'Guardar',
  testID,
}: SaveAsModalProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(currentTitle);

  React.useEffect(() => {
    if (visible) setTitle(currentTitle);
  }, [visible, currentTitle]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 360,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        },
        title: { fontSize: 18, fontWeight: '700' as const, color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 20,
        },
        row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
        cancelBtn: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: colors.surfaceSecondary,
        },
        cancelText: { fontSize: 14, fontWeight: '600' as const, color: colors.textSecondary },
        saveBtn: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: colors.accent,
        },
        saveText: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
        <View style={styles.card}>
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={placeholderText}
            placeholderTextColor={colors.placeholder}
            autoFocus
            selectTextOnFocus
            testID={testID ? `${testID}-input` : undefined}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} testID={testID ? `${testID}-cancel` : undefined}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !title.trim() && { opacity: 0.5 }]}
              onPress={() => title.trim() && onSave(title.trim())}
              disabled={!title.trim()}
              testID={testID ? `${testID}-confirm` : undefined}
            >
              <Text style={styles.saveText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
