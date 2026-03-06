import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Cloud, Save, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Note } from '@/types/notes';

interface NoteTabBarProps {
  tabs: Note[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export default React.memo(function NoteTabBar({ tabs, activeId, onSelect, onClose }: NoteTabBarProps) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        scroll: { paddingHorizontal: 8, paddingVertical: 6 },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          marginRight: 6,
          maxWidth: 190,
        },
        iconWrap: {
          width: 18,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 6,
        },
        tabText: {
          flex: 1,
          fontSize: 13,
          fontWeight: '500' as const,
          marginRight: 6,
        },
        closeBtn: {
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
      }),
    [colors]
  );

  if (tabs.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const iconColor = isActive ? colors.accent : colors.textSecondary;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.accentLight : colors.surfaceSecondary,
                },
              ]}
              onPress={() => onSelect(tab.id)}
              activeOpacity={0.7}
              testID={`note-tab-${tab.id}`}
            >
              <View style={styles.iconWrap}>
                {tab.storageType === 'local' ? (
                  <Save size={13} color={iconColor} />
                ) : (
                  <Cloud size={13} color={iconColor} />
                )}
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.accent : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: isActive ? colors.accent + '20' : colors.border }]}
                onPress={() => onClose(tab.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`close-note-tab-${tab.id}`}
              >
                <X size={10} color={isActive ? colors.accent : colors.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});
