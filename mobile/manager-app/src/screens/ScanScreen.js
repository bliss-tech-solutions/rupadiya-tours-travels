import React, { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { useTrip } from '../TripContext';
import { colors, radius } from '../theme';
import { Banner, Button, EmptyState } from '../components/ui';
import TicketSheet, { ticketFromManifest } from '../components/TicketSheet';

/** Scan a ticket QR (or type the PNR) → full ticket with boarding / dropping details and actions. */
export default function ScanScreen({ active, onGoHome }) {
  const { trip, manifest, offline, runAction, load } = useTrip();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [scanError, setScanError] = useState('');
  const [pnr, setPnr] = useState('');
  const [manual, setManual] = useState(false);
  const lock = useRef(false);

  if (!trip) {
    return <EmptyState icon="scan-outline" title="Choose your bus first" message="Pick today's bus on Home, then scan tickets here." action={<Button title="Go to Home" icon="home" onPress={onGoHome} />} />;
  }

  const lookup = async ({ qrToken, pnr: code }) => {
    if (lock.current) return;
    lock.current = true;
    setChecking(true);
    setScanError('');
    try {
      const res = await api.verify(trip._id, qrToken ? { qrToken } : { pnr: code });
      Haptics.notificationAsync(res.ticket.canBoard ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setTicket({ ...res.ticket, ...(qrToken ? { qrToken } : {}) });
    } catch (e) {
      if (e.code === 'OFFLINE') {
        // Offline: match against the saved passenger list (the server re-checks when syncing).
        const bookingId = qrToken ? String(qrToken).split('.')[1] : null;
        const row = (manifest?.passengers || []).find((p) => (bookingId && p.bookingId === bookingId) || (code && p.pnr === String(code).trim().toUpperCase()));
        if (row) {
          setTicket({ ...ticketFromManifest(manifest, row.bookingId), ...(qrToken ? { qrToken } : {}), offlineCheck: true });
        } else {
          setScanError('Offline and this ticket is not in the saved passenger list of this bus.');
          lock.current = false;
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setScanError(e.message);
        // Allow the next scan after a short pause so the same bad code isn't read 20 times.
        setTimeout(() => { lock.current = false; }, 1500);
      }
    } finally {
      setChecking(false);
    }
  };

  const closeTicket = () => {
    setTicket(null);
    setPnr('');
    setTimeout(() => { lock.current = false; }, 600);
  };

  const refreshTicket = async () => {
    if (!ticket) return;
    try {
      const res = await api.verify(trip._id, ticket.qrToken ? { qrToken: ticket.qrToken } : { pnr: ticket.pnr });
      setTicket((t) => ({ ...res.ticket, qrToken: t?.qrToken }));
    } catch (e) {
      // Offline: rebuild from the (optimistically updated) saved list
      load({ silent: true });
    }
  };

  const camAllowed = permission?.granted;
  // Offline checks follow the saved list, which is updated right away when an action is queued.
  const shownTicket = ticket?.offlineCheck && manifest
    ? { ...(ticketFromManifest(manifest, ticket.bookingId) || ticket), qrToken: ticket.qrToken, offlineCheck: true }
    : ticket;
  const tripInfo = manifest?.trip || trip;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {camAllowed && active && !ticket && !manual ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={checking || scanError ? undefined : ({ data }) => lookup({ qrToken: data })}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.header }} />
      )}

      {/* Overlay */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>Scan ticket</Text>
          <Text style={{ color: colors.headerSub, fontSize: 13 }} numberOfLines={1}>{tripInfo.from} → {tripInfo.to} · {tripInfo.bus?.busNumber || ''}</Text>
          {offline ? <View style={{ marginTop: 8 }}><Banner text="Offline — tickets are checked against the saved list." /></View> : null}
        </View>

        {!camAllowed && !manual ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Ionicons name="camera-outline" size={56} color={colors.headerSub} />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>Allow the camera to scan ticket QR codes</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <Button title="Allow camera" icon="camera" onPress={async () => {
                const r = await requestPermission();
                if (!r.granted && !r.canAskAgain) Linking.openSettings();
              }} />
            </View>
          </View>
        ) : manual ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 22 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: radius.xl, padding: 18 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>Enter PNR</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>The PNR is printed on the ticket and sent on WhatsApp.</Text>
              <TextInput value={pnr} onChangeText={(v) => setPnr(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} autoCapitalize="characters" autoCorrect={false} autoFocus
                placeholder="PNR" placeholderTextColor={colors.faint} returnKeyType="search"
                onSubmitEditing={() => pnr.length >= 4 && lookup({ pnr })}
                style={{ marginTop: 12, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontSize: 20, fontWeight: '900', letterSpacing: 2, color: colors.text }} />
              <View style={{ marginTop: 12 }}>
                <Button title="Find ticket" icon="search" loading={checking} disabled={pnr.length < 4} onPress={() => { Keyboard.dismiss(); lookup({ pnr }); }} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: 250, height: 250 }}>
              {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([v, h]) => (
                <View key={`${v}${h}`} style={{ position: 'absolute', width: 46, height: 46, borderColor: '#60A5FA', [v ? 'bottom' : 'top']: 0, [h ? 'right' : 'left']: 0, [v ? 'borderBottomWidth' : 'borderTopWidth']: 5, [h ? 'borderRightWidth' : 'borderLeftWidth']: 5, [`border${v ? 'Bottom' : 'Top'}${h ? 'Right' : 'Left'}Radius`]: 18 }} />
              ))}
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 18, fontSize: 14 }}>Point the camera at the ticket QR code</Text>
            {checking ? <ActivityIndicator color="#fff" style={{ marginTop: 12 }} /> : null}
          </View>
        )}

        {scanError ? (
          <View style={{ marginHorizontal: 18, marginBottom: 12, backgroundColor: colors.danger, borderRadius: radius.lg, padding: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name="close-circle" size={26} color="#fff" />
              <Text style={{ flex: 1, color: '#fff', fontWeight: '800', fontSize: 14 }}>{scanError}</Text>
            </View>
            <Pressable onPress={() => { setScanError(''); lock.current = false; }} style={{ marginTop: 10, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Scan again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 16 }}>
          {!manual && camAllowed ? (
            <RoundAction icon={torch ? 'flashlight' : 'flashlight-outline'} label={torch ? 'Light on' : 'Light'} onPress={() => setTorch((x) => !x)} />
          ) : null}
          <RoundAction icon={manual ? 'qr-code-outline' : 'keypad-outline'} label={manual ? 'Scan QR' : 'Type PNR'} onPress={() => { setManual((m) => !m); setScanError(''); lock.current = false; }} />
        </View>
      </View>

      <TicketSheet
        visible={Boolean(ticket)}
        ticket={shownTicket}
        trip={manifest?.trip || trip}
        offline={offline}
        onClose={closeTicket}
        runAction={runAction}
        onAfterAction={refreshTicket}
      />
    </View>
  );
}

function RoundAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
