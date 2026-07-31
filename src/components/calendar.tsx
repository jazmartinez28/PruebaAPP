import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseISO, toISO } from '@/lib/dates';
import { Body } from './ui';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function Calendar({
  start,
  end,
  onChange,
}: {
  start?: string;
  end?: string;
  onChange: (start?: string, end?: string) => void;
}) {
  const t = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));

  const startD = start ? parseISO(start) : null;
  const endD = end ? parseISO(end) : null;

  const pick = (d: Date) => {
    const iso = toISO(d);
    if (!startD || (startD && endD)) {
      onChange(iso, undefined);
    } else if (d < startD) {
      onChange(iso, undefined);
    } else {
      onChange(start, iso);
    }
  };

  const shift = (n: number) => {
    let m = view.m + n;
    let y = view.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setView({ y, m });
  };

  const inRange = (d: Date) => startD && endD && d > startD && d < endD;
  const isStart = (d: Date) => startD && d.getTime() === startD.getTime();
  const isEnd = (d: Date) => endD && d.getTime() === endD.getTime();
  const isPast = (d: Date) => d < today;

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          onPress={() => shift(-1)}
          hitSlop={8}
          style={styles.nav}>
          <Ionicons name="chevron-back" size={20} color={t.text} />
        </Pressable>
        <Body style={{ fontWeight: '700' }}>
          {MESES[view.m]} {view.y}
        </Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          onPress={() => shift(1)}
          hitSlop={8}
          style={styles.nav}>
          <Ionicons name="chevron-forward" size={20} color={t.text} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEK.map((w, i) => (
          <Body key={i} muted style={styles.weekLabel}>
            {w}
          </Body>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const past = isPast(d);
          const s = isStart(d);
          const e = isEnd(d);
          const mid = inRange(d);
          const selected = Boolean(s || e);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${d.getDate()} de ${MESES[view.m]} de ${view.y}`}
              accessibilityState={{ disabled: past, selected }}
              disabled={past}
              onPress={() => pick(d)}
              style={[styles.cell, mid && { backgroundColor: t.primarySoft }]}>
              <View style={[styles.day, selected && { backgroundColor: t.primary }]}>
                <Body
                  style={{
                    fontWeight: selected ? '800' : '500',
                    color: past ? t.border : selected ? t.textOnPrimary : mid ? t.primaryStrong : t.text,
                  }}>
                  {d.getDate()}
                </Body>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  nav: { padding: 4 },
  week: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
