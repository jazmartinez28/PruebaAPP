import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Body, Button, Card, Chip, H1, H2, Label, Screen } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getNotificationPermission, requestNotificationPermission, syncTripNotifications } from '@/lib/notifications';
import { useStore } from '@/store/useStore';
import type { AppPreferences, NotificationPreferences } from '@/types';

type Section = 'account' | 'preferences' | 'notifications' | 'privacy' | 'help' | 'terms';

export default function SettingsScreen() {
  const { section = 'account' } = useLocalSearchParams<{ section?: Section }>();
  const router = useRouter();
  const t = useTheme();
  const title = {
    account: 'Datos personales',
    preferences: 'Idioma y preferencias',
    notifications: 'Notificaciones',
    privacy: 'Privacidad',
    help: 'Ayuda',
    terms: 'Información legal',
  }[section] ?? 'Configuración';

  return (
    <Screen fullScreen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Volver" hitSlop={10} onPress={() => router.back()} style={[styles.back, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <H1 style={{ flex: 1, fontSize: 26 }}>{title}</H1>
      </View>
      {section === 'account' && <AccountSection />}
      {section === 'preferences' && <PreferencesSection />}
      {section === 'notifications' && <NotificationsSection />}
      {section === 'privacy' && <PrivacySection />}
      {section === 'help' && <HelpSection />}
      {section === 'terms' && <TermsSection />}
    </Screen>
  );
}

function AccountSection() {
  const t = useTheme();
  const user = useStore((s) => s.user);
  const updateProfile = useStore((s) => s.updateProfile);
  const changePassword = useStore((s) => s.changePassword);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFeedback({ type: 'error', text: 'Necesitamos permiso para elegir una foto.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (!result.canceled && result.assets[0]?.uri) updateProfile({ photoUri: result.assets[0].uri });
  };

  if (!user) return <EmptyAccount />;
  return (
    <>
      <Card style={styles.photoCard}>
        {user.photoUri ? (
          <Image source={user.photoUri} style={styles.photo} contentFit="cover" transition={180} />
        ) : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: t.primarySoft }]}>
            <Body style={{ color: t.primary, fontSize: 28, fontWeight: '900' }}>{user.name.slice(0, 1).toUpperCase()}</Body>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '900', fontSize: 17 }}>Tu foto de perfil</Body>
          <Body muted style={{ fontSize: 12 }}>Se guarda en este dispositivo.</Body>
        </View>
        <Button title="Cambiar" size="md" variant="ghost" onPress={pickPhoto} />
      </Card>
      <Card style={{ gap: Spacing.three }}>
        <H2>Información personal</H2>
        <Field label="Nombre" value={name} onChangeText={setName} />
        <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button title="Guardar datos" icon="checkmark" onPress={() => {
          const result = updateProfile({ name, email });
          setFeedback({ type: result.ok ? 'ok' : 'error', text: result.ok ? 'Datos actualizados.' : result.error ?? 'No pudimos guardar.' });
        }} />
      </Card>
      <Card style={{ gap: Spacing.three }}>
        <H2>Cambiar contraseña</H2>
        <Field label="Contraseña actual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Field label="Nueva contraseña" value={nextPassword} onChangeText={setNextPassword} secureTextEntry />
        <Button title="Actualizar contraseña" variant="ghost" onPress={() => {
          const result = changePassword(currentPassword, nextPassword);
          setFeedback({ type: result.ok ? 'ok' : 'error', text: result.ok ? 'Contraseña actualizada.' : result.error ?? 'No pudimos actualizarla.' });
          if (result.ok) { setCurrentPassword(''); setNextPassword(''); }
        }} />
      </Card>
      {feedback && <Feedback {...feedback} />}
    </>
  );
}

function EmptyAccount() {
  const router = useRouter();
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five }}>
      <Ionicons name="person-circle-outline" size={46} color="#667085" />
      <Body muted style={{ textAlign: 'center' }}>Iniciá sesión para editar tus datos personales y tu contraseña.</Body>
      <Button title="Iniciar sesión" onPress={() => router.push('/auth')} />
    </Card>
  );
}

function PreferencesSection() {
  const preferences = useStore((s) => s.preferences);
  const updatePreferences = useStore((s) => s.updatePreferences);
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<AppPreferences>) => { updatePreferences(patch); setSaved(true); };
  return (
    <>
      <OptionGroup title="Idioma" description="El contenido de la app usará este idioma.">
        {([['es', 'Español'], ['en', 'English'], ['pt', 'Português']] as const).map(([value, label]) => (
          <Chip key={value} label={label} selected={preferences.language === value} onPress={() => update({ language: value })} />
        ))}
      </OptionGroup>
      <OptionGroup title="Moneda" description="Auto usa la moneda principal del destino.">
        {(['auto', 'EUR', 'USD', 'ARS', 'JPY'] as const).map((value) => (
          <Chip key={value} label={value === 'auto' ? 'Automática' : value} selected={preferences.currency === value} onPress={() => update({ currency: value })} />
        ))}
      </OptionGroup>
      <OptionGroup title="Ritmo preferido" description="Lo usaremos como valor inicial en tus próximos viajes.">
        {([['tranquilo', 'Tranquilo'], ['equilibrado', 'Equilibrado'], ['intenso', 'Intenso']] as const).map(([value, label]) => (
          <Chip key={value} label={label} selected={preferences.travelStyle === value} onPress={() => update({ travelStyle: value })} />
        ))}
      </OptionGroup>
      {saved && <Feedback type="ok" text="Preferencias guardadas en este dispositivo." />}
    </>
  );
}

function NotificationsSection() {
  const prefs = useStore((s) => s.preferences.notifications);
  const trips = useStore((s) => s.trips);
  const updatePreferences = useStore((s) => s.updatePreferences);
  const [draft, setDraft] = useState(prefs);
  const [permission, setPermission] = useState<'loading' | 'granted' | 'prompt' | 'denied' | 'unsupported'>('loading');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => { getNotificationPermission().then(setPermission).catch(() => setPermission('denied')); }, []);
  const change = (patch: Partial<NotificationPreferences>) => setDraft((current) => ({ ...current, ...patch }));
  const save = async () => {
    setSaving(true);
    setFeedback(null);
    let currentPermission = permission;
    if (draft.enabled && currentPermission !== 'granted') currentPermission = await requestNotificationPermission();
    setPermission(currentPermission);
    if (draft.enabled && currentPermission !== 'granted') {
      setSaving(false);
      setFeedback(currentPermission === 'unsupported' ? 'Las notificaciones locales se configuran desde la app instalada en iOS o Android.' : 'El permiso está desactivado. Podés habilitarlo desde Ajustes del dispositivo.');
      return;
    }
    updatePreferences({ notifications: draft });
    const result = await syncTripNotifications(trips, draft);
    setSaving(false);
    setFeedback(result.error ?? (draft.enabled ? `${result.scheduled} recordatorios programados sin duplicados.` : 'Recordatorios desactivados.'));
  };

  return (
    <>
      <Card style={[styles.permissionCard, { borderColor: permission === 'granted' ? '#16A085' : '#F59E0B' }]}>
        <Ionicons name={permission === 'granted' ? 'checkmark-circle' : 'notifications-off-outline'} size={22} color={permission === 'granted' ? '#16A085' : '#F59E0B'} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '900' }}>{permission === 'granted' ? 'Permiso activo' : permission === 'unsupported' ? 'Disponible en la app móvil' : 'Permiso pendiente'}</Body>
          <Body muted style={{ fontSize: 12 }}>Rumbo solo programa recordatorios de tus viajes guardados.</Body>
        </View>
      </Card>
      <Card style={{ padding: 0 }}>
        <ToggleRow label="Todas las notificaciones" description="Control general" value={draft.enabled} onValueChange={(enabled) => change({ enabled })} />
        <ToggleRow label="Recordatorios del viaje" description="Una semana, un día y al comenzar" value={draft.tripReminders} onValueChange={(tripReminders) => change({ tripReminders })} />
        <ToggleRow label="Resumen diario" description="Plan del día antes de salir" value={draft.dailySummary} onValueChange={(dailySummary) => change({ dailySummary })} />
        <ToggleRow label="Primera actividad" description="Aviso antes de comenzar" value={draft.firstActivity} onValueChange={(firstActivity) => change({ firstActivity })} />
        <ToggleRow label="Cada actividad" description="Puede generar varios avisos por día" value={draft.upcomingActivity} onValueChange={(upcomingActivity) => change({ upcomingActivity })} />
        <ToggleRow label="Tickets pendientes" description="Tres días antes del viaje" value={draft.tickets} onValueChange={(tickets) => change({ tickets })} last />
      </Card>
      <OptionGroup title="Anticipación" description="Para la primera actividad y avisos próximos.">
        {([15, 30, 60] as const).map((value) => <Chip key={value} label={`${value} min`} selected={draft.activityLeadMin === value} onPress={() => change({ activityLeadMin: value })} />)}
      </OptionGroup>
      <Button title="Guardar y programar" icon="notifications-outline" loading={saving} onPress={save} />
      {feedback && <Feedback type={permission === 'granted' ? 'ok' : 'error'} text={feedback} />}
    </>
  );
}

function PrivacySection() {
  const router = useRouter();
  const deleteAccount = useStore((s) => s.deleteAccount);
  const user = useStore((s) => s.user);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Card style={{ gap: Spacing.two }}>
        <H2>Privacidad por diseño</H2>
        <Body muted>Los viajes y preferencias se guardan localmente. Los enlaces públicos no se habilitan hasta configurar un backend con control de acceso.</Body>
        <Info icon="lock-closed-outline" text="No incluimos códigos de tickets ni correo en contenido compartido." />
        <Info icon="phone-portrait-outline" text="Podés usar la app como invitado sin registrar datos personales." />
      </Card>
      {user && <Button title="Eliminar mi cuenta y datos locales" icon="trash-outline" variant="ghost" onPress={() => setConfirm(true)} />}
      <ConfirmDialog
        visible={confirm}
        destructive
        icon="warning-outline"
        title="¿Eliminar tu cuenta y todos los viajes?"
        message="Se borrarán de este dispositivo tu cuenta local, itinerarios, tickets y valijas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar todo"
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); deleteAccount(); router.replace('/'); }}
      />
    </>
  );
}

function HelpSection() {
  return (
    <>
      <Card style={{ gap: Spacing.two }}><H2>¿Cómo podemos ayudarte?</H2><Body muted>Contanos qué viaje estabas armando y qué pasó. No incluyas contraseñas ni códigos de tickets.</Body></Card>
      <Button title="Escribir a soporte" icon="mail-outline" onPress={() => Linking.openURL(`mailto:soporte@rumbo.app?subject=${encodeURIComponent('Ayuda con Rumbo')}`)} />
      <Card style={{ gap: Spacing.two }}>
        <Info icon="map-outline" text="Si un lugar tiene datos inciertos, verificá el enlace oficial antes de viajar." />
        <Info icon="cloud-offline-outline" text="El itinerario guardado sigue disponible aunque pierdas conexión." />
      </Card>
    </>
  );
}

function TermsSection() {
  return (
    <>
      <Card style={{ gap: Spacing.two }}><H2>Términos de uso</H2><Body muted>{APP_NAME} organiza información para ayudarte a planificar. Horarios, precios, disponibilidad y transporte pueden cambiar; verificá datos críticos con la fuente oficial.</Body></Card>
      <Card style={{ gap: Spacing.two }}><H2>Política de privacidad</H2><Body muted>La versión actual persiste tus datos en el dispositivo. Las integraciones externas solo reciben la información necesaria para la función solicitada y se identifican en la interfaz.</Body></Card>
      <Body muted style={{ textAlign: 'center', fontSize: 12 }}>Versión 1.0 · Actualizado en julio de 2026</Body>
    </>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  return <View style={{ gap: 6 }}><Label>{label}</Label><TextInput {...props} placeholderTextColor={t.textSecondary} style={[styles.input, { color: t.text, borderColor: t.border }, props.style]} /></View>;
}

function OptionGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card style={{ gap: Spacing.three }}><View><H2>{title}</H2><Body muted style={{ fontSize: 12 }}>{description}</Body></View><View style={styles.chips}>{children}</View></Card>;
}

function ToggleRow({ label, description, value, onValueChange, last }: { label: string; description: string; value: boolean; onValueChange: (value: boolean) => void; last?: boolean }) {
  const t = useTheme();
  return <View style={[styles.toggleRow, !last && { borderBottomColor: t.border, borderBottomWidth: 1 }]}><View style={{ flex: 1 }}><Body style={{ fontWeight: '800' }}>{label}</Body><Body muted style={{ fontSize: 12 }}>{description}</Body></View><Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ false: t.border, true: t.secondary }} thumbColor="#fff" /></View>;
}

function Feedback({ type, text }: { type: 'ok' | 'error'; text: string }) {
  const t = useTheme();
  const color = type === 'ok' ? t.secondary : t.error;
  return <View style={[styles.feedback, { backgroundColor: color + '16' }]}><Ionicons name={type === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={19} color={color} /><Body style={{ color, flex: 1, fontSize: 13 }}>{text}</Body></View>;
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  return <View style={styles.info}><Ionicons name={icon} size={19} color={t.secondary} /><Body style={{ flex: 1, fontSize: 13 }}>{text}</Body></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  back: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photo: { width: 64, height: 64, borderRadius: Radius.pill },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: 14, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1.5 },
  toggleRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: Spacing.three, borderRadius: Radius.md },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
