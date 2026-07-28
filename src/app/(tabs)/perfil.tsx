import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Card, H1, Label, Screen } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store/useStore';

const ITEMS = [
  { icon: 'globe-outline', label: 'Idioma y moneda' },
  { icon: 'notifications-outline', label: 'Notificaciones' },
  { icon: 'shield-checkmark-outline', label: 'Privacidad' },
  { icon: 'help-circle-outline', label: 'Ayuda' },
] as const;

export default function PerfilScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const trips = useStore((s) => s.trips);

  return (
    <Screen>
      <H1>Perfil</H1>

      <Card style={styles.userRow}>
        <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
          <Ionicons name="person" size={26} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700', fontSize: 17 }}>{user ? user.name : 'Invitado'}</Body>
          <Body muted style={{ fontSize: 13 }}>
            {user ? user.email : 'Creá una cuenta para guardar y sincronizar tus viajes'}
          </Body>
        </View>
      </Card>

      {user ? (
        <Button title="Cerrar sesión" icon="log-out-outline" variant="ghost" size="md" onPress={logout} />
      ) : (
        <Button title="Crear cuenta o iniciar sesión" icon="log-in-outline" onPress={() => router.push('/auth')} />
      )}

      <Card style={styles.planRow}>
        <View>
          <Label>Tu plan</Label>
          <Body style={{ fontWeight: '800', fontSize: 18, marginTop: 2, color: user?.plan === 'premium' ? t.secondary : t.text }}>
            {user?.plan === 'premium' ? 'Premium ✨' : 'Gratis'}
          </Body>
          <Body muted style={{ fontSize: 12 }}>{trips.length} viaje(s) guardado(s)</Body>
        </View>
        {user?.plan !== 'premium' && (
          <Pressable onPress={() => router.push('/paywall')} style={[styles.upgrade, { borderColor: t.primary }]}>
            <Ionicons name="star" size={14} color={t.primary} />
            <Body style={{ color: t.primaryStrong, fontWeight: '700', fontSize: 13 }}>Ver Premium</Body>
          </Pressable>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        {ITEMS.map((it, i) => (
          <View key={it.label} style={[styles.item, i < ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
            <Ionicons name={it.icon as any} size={22} color={t.textSecondary} />
            <Body style={{ flex: 1 }}>{it.label}</Body>
            <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
          </View>
        ))}
      </Card>

      <Body muted style={{ textAlign: 'center', fontSize: 12 }}>{APP_NAME} · versión 0.1.0</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
});
