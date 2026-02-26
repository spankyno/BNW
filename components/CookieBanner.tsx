import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Cookie } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface CookieBannerProps {
  onAccept: () => void;
}

export default React.memo(function CookieBanner({ onAccept }: CookieBannerProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
        },
        icon: { marginRight: 12 },
        textWrap: { flex: 1, marginRight: 12 },
        title: { fontSize: 13, fontWeight: '600' as const, color: colors.text, marginBottom: 2 },
        desc: { fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
        btn: {
          backgroundColor: colors.accent,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
        },
        btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' as const },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <Cookie size={24} color={colors.accent} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>Aviso de Cookies</Text>
        <Text style={styles.desc}>
          Esta app usa almacenamiento local para guardar tus notas y preferencias.
        </Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={onAccept} activeOpacity={0.8}>
        <Text style={styles.btnText}>Aceptar</Text>
      </TouchableOpacity>
    </View>
  );
});
