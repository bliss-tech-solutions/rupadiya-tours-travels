import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, getApiBase } from '../api';
import { flushQueue } from '../offline';
import { useTrip } from '../TripContext';
import { colors, radius } from '../theme';
import { formatPhone } from '../format';
import { Banner, Button, ContactRow, InfoRow, SectionTitle } from '../components/ui';
import ConfirmSheet from '../components/ConfirmSheet';

export default function ProfileScreen({ user, onLogout, onBack }) {
  const { pending, refreshPending, load } = useTrip();
  const [me, setMe] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    refreshPending();
  }, [refreshPending]);

  const m = me?.manager || user || {};
  const initials = String(m.name || 'BM').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  const syncNow = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await flushQueue();
      await refreshPending();
      await load({ silent: true });
      setSyncMsg(r.pending ? `${r.sent} sent, ${r.pending} still waiting for internet.` : `${r.sent} action(s) synced.`);
    } catch (e) {
      setSyncMsg(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800' }}>Home</Text>
        </Pressable>
      ) : null}
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text, marginTop: 10 }}>{m.name || 'Bus Manager'}</Text>
        <Text style={{ color: colors.muted }}>Bus Manager{me?.company?.name ? ` · ${me.company.name}` : ''}</Text>
      </View>

      <SectionTitle title="Account" />
      <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
        <InfoRow icon="mail-outline" label="Email" value={m.email} />
        <InfoRow icon="call-outline" label="Mobile" value={formatPhone(m.phone)} />
        <InfoRow icon="business-outline" label="Company" value={me?.company?.name || (m.companyCode ? `#${m.companyCode}` : '')} last />
      </View>

      {me?.company?.phone ? (
        <>
          <SectionTitle title="Help" />
          <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            <ContactRow icon="business-outline" title="Company office" phone={me.company.phone} who="the company office" tone="violet" />
          </View>
        </>
      ) : null}

      <SectionTitle title="Offline actions" />
      <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{pending ? `${pending} action(s) waiting for internet` : 'Everything is synced'}</Text>
        {syncMsg ? <Banner tone="info" icon="sync" text={syncMsg} /> : null}
        <Button title="Sync now" icon="sync" tone="outline" loading={syncing} onPress={syncNow} />
      </View>

      <SectionTitle title="App" />
      <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
        <InfoRow icon="server-outline" label="Server" value={getApiBase()} />
        <InfoRow icon="information-circle-outline" label="Version" value={Constants.expoConfig?.version || '1.0.0'} last />
      </View>

      <View style={{ marginTop: 24 }}>
        <Button title="Log out" icon="log-out-outline" tone="danger" onPress={() => setConfirmLogout(true)} />
      </View>

      <ConfirmSheet
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        icon="log-out-outline"
        tone="danger"
        title="Log out?"
        message={pending ? `${pending} action(s) are not synced yet. They stay on this phone and sync after you log in again.` : 'You can log in again with your email and password.'}
        confirmLabel="Log out"
        onConfirm={async () => { await onLogout(); }}
      />
    </ScrollView>
  );
}
