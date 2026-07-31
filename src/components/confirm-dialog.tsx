import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Body, H2 } from './ui';

/**
 * Diálogo de confirmación reutilizable para acciones destructivas o importantes.
 * Accesible, con botón secundario (Cancelar) y botón principal (que puede ser destructivo).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  icon = 'alert-circle',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const accent = destructive ? t.error : t.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Cerrar" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: t.surface }]} accessibilityViewIsModal>
          <View style={[styles.iconWrap, { backgroundColor: destructive ? t.error + '18' : t.primarySoft }]}>
            <Ionicons name={icon} size={26} color={accent} />
          </View>
          <H2 style={{ textAlign: 'center' }}>{title}</H2>
          {message ? (
            <Body muted style={{ textAlign: 'center', lineHeight: 21 }}>
              {message}
            </Body>
          ) : null}
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, { borderColor: t.border, backgroundColor: t.surface }, pressed && { opacity: 0.7 }]}>
              <Body style={{ fontWeight: '700', color: t.text }}>{cancelLabel}</Body>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, { backgroundColor: accent, borderColor: accent }, pressed && { opacity: 0.85 }]}>
              <Body style={{ fontWeight: '800', color: '#fff' }}>{confirmLabel}</Body>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconWrap: { width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three, alignSelf: 'stretch' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
