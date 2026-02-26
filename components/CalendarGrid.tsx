import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface CalendarGridProps {
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  datesWithNotes: Set<string>;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default React.memo(function CalendarGrid({ selectedDate, onSelectDate, datesWithNotes }: CalendarGridProps) {
  const { colors } = useTheme();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const goToPrev = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNext = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const days = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells: Array<{ day: number; dateStr: string } | null> = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: formatDateKey(year, month, d) });
    }
    return cells;
  }, [year, month]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { paddingHorizontal: 4 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingHorizontal: 4,
        },
        headerText: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
        navBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surfaceSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        weekRow: { flexDirection: 'row', marginBottom: 8 },
        weekDay: {
          flex: 1,
          textAlign: 'center' as const,
          fontSize: 12,
          fontWeight: '600' as const,
          color: colors.textSecondary,
          paddingVertical: 4,
        },
        grid: { flexDirection: 'row', flexWrap: 'wrap' as const },
        cell: {
          width: '14.28%' as unknown as number,
          aspectRatio: 1,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          padding: 2,
        },
        dayBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        dayText: { fontSize: 14, fontWeight: '500' as const },
        dot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          position: 'absolute' as const,
          bottom: 4,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrev} style={styles.navBtn}>
          <ChevronLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goToNext} style={styles.navBtn}>
          <ChevronRight size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={styles.weekDay}>
            {wd}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((cell, idx) => (
          <View key={idx} style={styles.cell}>
            {cell ? (
              <TouchableOpacity
                onPress={() => onSelectDate(cell.dateStr)}
                style={[
                  styles.dayBtn,
                  selectedDate === cell.dateStr && { backgroundColor: colors.accent },
                  todayStr === cell.dateStr && selectedDate !== cell.dateStr && {
                    backgroundColor: colors.accentLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color:
                        selectedDate === cell.dateStr
                          ? '#FFFFFF'
                          : todayStr === cell.dateStr
                          ? colors.accent
                          : colors.text,
                    },
                  ]}
                >
                  {cell.day}
                </Text>
                {datesWithNotes.has(cell.dateStr) && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          selectedDate === cell.dateStr ? '#FFFFFF' : colors.accent,
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});
