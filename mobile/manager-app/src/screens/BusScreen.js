import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrip } from '../TripContext';
import { colors, radius, shadow, TRIP_STATUS } from '../theme';
import { dateTime, dayLabel, pointTime, time } from '../format';
import { Banner, Button, ContactRow, EmptyState, InfoRow, Pill, SectionTitle } from '../components/ui';
import ConfirmSheet from '../components/ConfirmSheet';
import { newActionId } from '../offline';

/** Bus, driver, company, route stops and the start / complete journey actions. */
export default function BusScreen({ onGoHome }) {
  const { trip, manifest, loading, load, runAction, offline } = useTrip();
  const [confirm, setConfirm] = useState(null); // 'start' | 'complete'
  const [actionId, setActionId] = useState(null);

  const t = manifest?.trip || trip;
  const passengers = useMemo(() => (manifest?.passengers || []).filter((p) => p.bookingStatus !== 'CANCELLED'), [manifest]);
  const perStop = useMemo(() => {
    const m = {};
    for (const p of passengers) {
      const k = p.boardingPoint?.name;
      if (!k) continue;
      m[k] = m[k] || { total: 0, boarded: 0 };
      m[k].total += 1;
      if (['BOARDED', 'DROPPED'].includes(p.journeyStatus)) m[k].boarded += 1;
    }
    return m;
  }, [passengers]);
  const dropsPerStop = useMemo(() => {
    const m = {};
    for (const p of passengers) {
      const k = p.droppingPoint?.name;
      if (k) m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [passengers]);

  if (!trip) {
    return <EmptyState icon="bus-outline" title="Choose your bus first" message="Pick the date and your bus on Home." action={<Button title="Go to Home" icon="home" onPress={onGoHome} />} />;
  }

  const bus = t.bus || {};
  const driver = bus.driver || {};
  const c = manifest?.counts || t.counts || {};
  const [statusLabel, statusFg, statusBg] = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
  const canStart = ['SCHEDULED', 'BOARDING'].includes(t.status);
  const canComplete = t.status === 'DEPARTED';
  const firstStop = t.boardingPoints?.[0]?.name;
  const waitingFirstStop = passengers.filter((p) => p.journeyStatus === 'NOT_BOARDED' && (!firstStop || p.boardingPoint?.name === firstStop)).length;
  const waitingLater = passengers.filter((p) => p.journeyStatus === 'NOT_BOARDED').length - waitingFirstStop;

  const openConfirm = (kind) => { setActionId(newActionId()); setConfirm(kind); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={Boolean(loading && manifest)} onRefresh={() => load()} tintColor={colors.primary} />}>
        {/* Bus hero */}
        <View style={[{ backgroundColor: colors.header, borderRadius: radius.xl, padding: 18 }, shadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: '#fde047', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: '#0f172a' }}>
              <Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: 1.5, color: '#0f172a' }}>{bus.busNumber || '—'}</Text>
            </View>
            <Pill label={statusLabel} fg={statusFg} bg={statusBg} />
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 14 }}>{bus.name || 'Bus'}</Text>
          <Text style={{ color: colors.headerSub, fontSize: 13, marginTop: 2 }}>{[bus.busType, bus.isAc === false ? 'Non-AC' : 'AC', bus.totalSeats ? `${bus.totalSeats} seats` : null].filter(Boolean).join(' · ')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
            <HeroStat value={`${t.seatsBooked ?? '—'}/${t.seatsTotal ?? bus.totalSeats ?? '—'}`} label="Seats sold" />
            <HeroStat value={`${c.boarded ?? 0}/${c.total ?? 0}`} label="Boarded" />
            <HeroStat value={c.infants ?? 0} label="Infants" />
          </View>
        </View>

        {offline ? <View style={{ marginTop: 12 }}><Banner text="Offline — showing saved details." /></View> : null}

        {/* Journey */}
        <SectionTitle title="Journey" />
        <View style={card}>
          <InfoRow icon="navigate-outline" label="Route" value={`${t.from} → ${t.to}`} />
          <InfoRow icon="calendar-outline" label="Departure" value={`${dayLabel(t.departureTime)}, ${time(t.departureTime)}`} />
          <InfoRow icon="flag-outline" label="Arrival" value={`${dayLabel(t.arrivalTime)}, ${time(t.arrivalTime)}`} />
          {t.distanceKm ? <InfoRow icon="speedometer-outline" label="Distance" value={`${t.distanceKm} km`} /> : null}
          {t.journey?.startedAt ? <InfoRow icon="play-circle-outline" label="Started" value={dateTime(t.journey.startedAt)} /> : null}
          {t.journey?.completedAt ? <InfoRow icon="checkmark-done-circle-outline" label="Completed" value={dateTime(t.journey.completedAt)} last /> : null}
          <View style={{ paddingTop: 12, gap: 8 }}>
            {canStart && <Button title="Start journey" icon="play" tone="blue" onPress={() => openConfirm('start')} />}
            {canComplete && <Button title="Complete journey" icon="checkmark-done" tone="dark" onPress={() => openConfirm('complete')} />}
            {t.status === 'COMPLETED' && <Banner tone="info" icon="checkmark-done-circle" text="This journey is completed." />}
          </View>
        </View>

        {/* Driver */}
        <SectionTitle title="Driver & crew" />
        <View style={[card, { paddingVertical: 4 }]}>
          <ContactRow icon="person-circle-outline" title={driver.name || 'Driver not set'} subtitle={driver.licenseNumber ? `Licence ${driver.licenseNumber}` : 'Driver'} phone={driver.phone} who="the driver" />
          {driver.alternatePhone ? (
            <View style={{ borderTopWidth: 1, borderColor: colors.divider }}>
              <ContactRow icon="people-circle-outline" title="Co-driver / alternate" phone={driver.alternatePhone} who="the co-driver" tone="blue" />
            </View>
          ) : null}
        </View>

        {/* Company */}
        <SectionTitle title="Bus company" />
        <View style={[card, { paddingVertical: 4 }]}>
          <ContactRow icon="business-outline" title={t.company?.name || bus.operatorName || 'Company'} subtitle="Company office" phone={t.company?.phone} who="the company office" tone="violet" />
        </View>

        {/* Stops */}
        <SectionTitle title="Boarding stops" />
        <View style={card}>
          {(t.boardingPoints || []).length ? t.boardingPoints.map((bp, i) => (
            <Stop key={bp.id || i} first={i === 0} last={i === t.boardingPoints.length - 1} name={bp.name} landmark={bp.landmark} time={pointTime(bp.time)}
              right={perStop[bp.name] ? `${perStop[bp.name].boarded}/${perStop[bp.name].total} boarded` : 'No passengers'} color={colors.primary} />
          )) : <Text style={{ color: colors.muted }}>No boarding stops set for this route.</Text>}
        </View>

        <SectionTitle title="Dropping stops" />
        <View style={card}>
          {(t.droppingPoints || []).length ? t.droppingPoints.map((dp, i) => (
            <Stop key={dp.id || i} first={i === 0} last={i === t.droppingPoints.length - 1} name={dp.name} landmark={dp.landmark} time={pointTime(dp.time)}
              right={dropsPerStop[dp.name] ? `${dropsPerStop[dp.name]} getting off` : ''} color={colors.danger} />
          )) : <Text style={{ color: colors.muted }}>No dropping stops set for this route.</Text>}
        </View>

        {bus.amenities?.length ? (
          <>
            <SectionTitle title="Amenities" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {bus.amenities.map((a) => <Pill key={a} label={a} icon="checkmark" fg={colors.textSoft} bg="#fff" border={colors.border} />)}
            </View>
          </>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={confirm === 'start'}
        onClose={() => setConfirm(null)}
        icon="play-circle"
        tone="blue"
        title="Start the journey?"
        message="The company and RBS get a WhatsApp summary."
        confirmLabel="Start journey"
        onConfirm={async () => { await runAction('start', {}, actionId); }}
      >
        <View style={{ gap: 8 }}>
          <SummaryLine icon="checkmark-circle" color={colors.primary} text={`${c.boarded ?? 0} of ${c.total ?? 0} passengers on board`} />
          {waitingFirstStop > 0 && <SummaryLine icon="close-circle" color={colors.warn} text={`${waitingFirstStop} not boarded at ${firstStop || 'the first stop'} → marked no-show`} />}
          {waitingLater > 0 && <SummaryLine icon="time" color={colors.blue} text={`${waitingLater} will board at later stops`} />}
          {c.cashPending ? <SummaryLine icon="alert-circle" color={colors.danger} text={`${c.cashPending} with payment pending`} /> : null}
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={confirm === 'complete'}
        onClose={() => setConfirm(null)}
        icon="checkmark-done-circle"
        tone="dark"
        title="Complete the journey?"
        message="Everyone still on board is marked dropped and gets a thank-you message. Anyone who never boarded becomes a no-show."
        confirmLabel="Complete journey"
        onConfirm={async () => { await runAction('complete', {}, actionId); }}
      >
        <View style={{ gap: 8 }}>
          <SummaryLine icon="people" color={colors.primary} text={`${passengers.filter((p) => p.journeyStatus === 'BOARDED').length} still on board`} />
          <SummaryLine icon="flag" color={colors.blue} text={`${c.dropped ?? 0} already dropped`} />
        </View>
      </ConfirmSheet>
    </View>
  );
}

const card = { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8 };

function HeroStat({ value, label }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.headerSub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Stop({ name, landmark, time, right, first, last, color }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', width: 14 }}>
        <View style={{ width: 2, flex: 1, backgroundColor: first ? 'transparent' : colors.border }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, borderWidth: 2, borderColor: '#fff' }} />
        <View style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : colors.border }} />
      </View>
      <View style={{ flex: 1, paddingVertical: 8 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>{name}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{[time, landmark].filter(Boolean).join(' · ')}</Text>
      </View>
      {right ? <Text style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' }}>{right}</Text> : null}
    </View>
  );
}

function SummaryLine({ icon, color, text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{text}</Text>
    </View>
  );
}
