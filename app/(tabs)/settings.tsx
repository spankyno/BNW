import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Switch, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Hash, Moon, Info, LogIn, LogOut, UserPlus, Cloud } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotes } from '@/contexts/NotesContext';

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const {
    settings,
    toggleLineNumbers,
    notes,
    auth,
    email,
    password,
    setEmail,
    setPassword,
    signUp,
    signIn,
    signOut,
    signUpCooldownUntil,
  } = useNotes();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        scroll: { padding: 16 },
        section: { marginBottom: 24 },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700' as const,
          color: colors.textSecondary,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.8,
          marginBottom: 10,
          paddingHorizontal: 4,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        authCard: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 10,
        },
        authRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        authTitle: { fontSize: 15, fontWeight: '700' as const, color: colors.text },
        authDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
        authInput: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
        },
        authButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          borderRadius: 12,
          gap: 8,
        },
        authPrimary: { backgroundColor: colors.accent },
        authSecondary: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
        authDanger: { backgroundColor: colors.destructive + '12', borderWidth: 1, borderColor: colors.destructive + '40' },
        authButtonText: { fontSize: 13, fontWeight: '700' as const, color: '#FFFFFF' },
        authButtonTextAlt: { fontSize: 13, fontWeight: '700' as const, color: colors.text },
        authError: { fontSize: 12, color: colors.destructive },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        rowBorder: {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        rowIcon: {
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        rowContent: { flex: 1 },
        rowTitle: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
        rowDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
        statsCard: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
        },
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: { alignItems: 'center' },
        statValue: {
          fontSize: 28,
          fontWeight: '800' as const,
          color: colors.accent,
        },
        statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        footer: {
          alignItems: 'center',
          paddingVertical: 24,
        },
        footerText: { fontSize: 12, color: colors.placeholder, textAlign: 'center', lineHeight: 18 },
      }),
    [colors]
  );

  const totalChars = useMemo(
    () => notes.reduce((sum, n) => sum + n.content.length, 0),
    [notes]
  );

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const signUpWaitSeconds = useMemo(() => {
    const diff = signUpCooldownUntil - now;
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }, [signUpCooldownUntil, now]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferencias</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accentLight }]}>
              <Hash size={17} color={colors.accent} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Números de línea</Text>
              <Text style={styles.rowDesc}>Mostrar números al lado del texto</Text>
            </View>
            <Switch
              value={settings.showLineNumbers}
              onValueChange={toggleLineNumbers}
              trackColor={{ false: colors.border, true: colors.accent + '60' }}
              thumbColor={settings.showLineNumbers ? colors.accent : colors.surfaceSecondary}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: theme === 'dark' ? '#2A2A3E' : '#E8E0F0' }]}>
              <Moon size={17} color={theme === 'dark' ? '#9B8EC4' : '#7B68A8'} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Modo oscuro</Text>
              <Text style={styles.rowDesc}>Alternar entre tema claro y oscuro</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accent + '60' }}
              thumbColor={theme === 'dark' ? colors.accent : colors.surfaceSecondary}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{notes.length}</Text>
              <Text style={styles.statLabel}>Notas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalChars > 999 ? `${(totalChars / 1000).toFixed(1)}k` : totalChars}</Text>
              <Text style={styles.statLabel}>Caracteres</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta y sincronización</Text>
        <View style={styles.authCard}>
          <View style={styles.authRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accentLight }]}>
              <Cloud size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authTitle}>Supabase</Text>
              <Text style={styles.authDesc}>Inicia sesión para registrar tu cuenta y sincronizar notas en la nube.</Text>
            </View>
          </View>

          {!auth.session ? (
            <>
              <TextInput
                style={styles.authInput}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                testID="auth-email"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Contraseña"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                testID="auth-password"
              />
              {auth.error ? <Text style={styles.authError}>{auth.error}</Text> : null}
              <TouchableOpacity
                style={[styles.authButton, styles.authPrimary]}
                onPress={signIn}
                disabled={auth.isLoading}
                testID="auth-signin"
              >
                {auth.isLoading ? <ActivityIndicator color="#FFFFFF" /> : <LogIn size={16} color="#FFFFFF" />}
                <Text style={styles.authButtonText}>Iniciar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authButton, styles.authSecondary]}
                onPress={signUp}
                disabled={auth.isLoading || signUpWaitSeconds > 0}
                testID="auth-signup"
              >
                <UserPlus size={16} color={colors.text} />
                <Text style={styles.authButtonTextAlt}>
                  {signUpWaitSeconds > 0 ? `Reintenta en ${signUpWaitSeconds}s` : 'Crear cuenta'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.authDesc}>Sesión activa: {auth.session.user.email ?? 'Sin email'}</Text>
              <TouchableOpacity
                style={[styles.authButton, styles.authDanger]}
                onPress={signOut}
                disabled={auth.isLoading}
                testID="auth-signout"
              >
                {auth.isLoading ? (
                  <ActivityIndicator color={colors.destructive} />
                ) : (
                  <LogOut size={16} color={colors.destructive} />
                )}
                <Text style={[styles.authButtonTextAlt, { color: colors.destructive }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceSecondary }]}>
              <Info size={17} color={colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Acerca de</Text>
              <Text style={styles.rowDesc}>
                BNW (Bloc Notas Web) — App de notas de texto plano. Sincroniza con Supabase al iniciar sesión. Desarrollado por Aitor Sánchez Gutiérrez (c) 2026. Todos los derechos reservados.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          BNW (Bloc Notas Web) v1.0
          {"\n"}
          Almacenamiento local + Supabase · Sincronización segura
        </Text>
      </View>
    </ScrollView>
  );
}
