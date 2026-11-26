import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrip } from '../TripContext';
import { colors, radius, TRIP_STATUS } from '../theme';
import { dayLabel, genderShort, pointTime, time } from '../format';
import { Banner, Button, CallButton, EmptyState, JourneyPill, PaymentPill, Pill, SeatBadge, SourcePill } from '../components/ui';
import TicketSheet, { ticketFromManifest } from '../components/TicketSheet';
import SeatMap from '../components/SeatMap';

const FILTERS = [
  ['all', 'All'],
  ['toBoard', 'Yet to board'],
  ['boarded', 'On board'],
  ['dropped', 'Dropped'],
  ['noShow', 'No-show'],
  ['pending', 'Payment pending'],
  ['agent', 'Agent tickets']
];

/** All passengers of the selected bus, grouped by boarding stop, with filters, search and actions. */
export default function PassengersScreen({ onGoHome }) {
  const { trip, manifest, loading, offline, error, load, runAction } = useTrip();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null); // { bookingId, seat }
  const [view, setView] = useState('list'); // 'list' | 'seats'

  const list = useMemo(() => (manifest?.passengers || []).filter((p) => p.bookingStatus !== 'CANCELLED'), [manifest]);

  const countsFor = useMemo(() => ({
    all: list.length,
    toBoard: list.filter((p) => p.journeyStatus === 'NOT_BOARDED').length,
    boarded: list.filter((p) => p.journeyStatus === 'BOARDED').length,
    dropped: list.filter((p) => p.journeyStatus === 'DROPPED').length,
    noShow: list.filter((p) => p.journeyStatus === 'NO_SHOW').length,
    pending: list.filter((p) => p.paymentStatus === 'PENDING' || p.payment === 'CASH_PENDING').length,
    agent: list.filter((p) => p.bookedBy === 'AGENT').length
  }), [list]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const rows = list.filter((p) => {
      if (filter === 'toBoard' && p.journeyStatus !== 'NOT_BOARDED') return false;
      if (filter === 'boarded' && p.journeyStatus !== 'BOARDED') return false;
      if (filter === 'dropped' && p.journeyStatus !== 'DROPPED') return false;
      if (filter === 'noShow' && p.journeyStatus !== 'NO_SHOW') return false;
      if (filter === 'pending' && !(p.paymentStatus === 'PENDING' || p.payment === 'CASH_PENDING')) return false;
      if (filter === 'agent' && p.bookedBy !== 'AGENT') return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.pnr.toLowerCase().includes(q)
        || String(p.seatNumber).toLowerCase() === q || (digits.length >= 4 && String(p.phone || '').includes(digits));
    });

    // Who still needs the manager stays on top:
    //   "Drop at <stop>"  — on board, by drop stop in route order (first stop first)
    //   "Board at <stop>" — waiting, by boarding stop in route order
    // During the journey drops come first; before departure boarding comes first.
    // No-show and dropped passengers move to their own sections at the bottom.
    const tr = manifest?.trip || {};
    const bOrder = new Map((tr.boardingPoints || []).map((x, i) => [x.name, { i, time: x.time }]));
    const dOrder = new Map((tr.droppingPoints || []).map((x, i) => [x.name, { i, time: x.time }]));
    const group = (items, keyOf, kind, orderMap, prefix) => {
      const m = new Map();
      for (const it of items) {
        const k = keyOf(it) || 'Stop not set';
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(it);
      }
      return [...m.entries()]
        .map(([name, data]) => ({
          kind,
          title: `${prefix} ${name}`,
          time: orderMap.get(name)?.time || null,
          order: orderMap.has(name) ? orderMap.get(name).i : 999,
          data: data.sort((a, b) => String(a.seatNumber).localeCompare(String(b.seatNumber), undefined, { numeric: true }))
        }))
        .sort((a, b) => a.order - b.order);
    };
    const onBoard = rows.filter((x) => x.journeyStatus === 'BOARDED');
    const waiting = rows.filter((x) => x.journeyStatus === 'NOT_BOARDED');
    const noShow = rows.filter((x) => x.journeyStatus === 'NO_SHOW');
    const dropped = rows.filter((x) => x.journeyStatus === 'DROPPED');
    const dropSections = group(onBoard, (x) => x.droppingPoint?.name, 'drop', dOrder, 'Drop at');
    const boardSections = group(waiting, (x) => x.boardingPoint?.name, 'board', bOrder, 'Board at');
    const onRoad = tr.status === 'DEPARTED';
    const out = onRoad ? [...dropSections, ...boardSections] : [...boardSections, ...dropSections];
    if (noShow.length) out.push({ kind: 'noShow', title: 'No-show', data: noShow });
    if (dropped.length) out.push({ kind: 'dropped', title: 'Dropped — journey done', data: dropped });
    return out;
  }, [list, filter, query, manifest]);

  if (!trip) {
    return <EmptyState icon="bus-outline" title="Choose your bus first" message="Open Home, pick the date and tap Passengers on your bus." action={<Button title="Go to Home" icon="home" onPress={onGoHome} />} />;
  }

  const t = manifest?.trip || trip;
  const [statusLabel, statusFg, statusBg] = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
  const c = manifest?.counts || trip.counts || {};
  const ticket = selected ? ticketFromManifest(manifest, selected.bookingId) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 19, fontWeight: '900', color: colors.text }} numberOfLines={1}>{t.from} → {t.to}</Text>
          <Pill label={statusLabel} fg={statusFg} bg={statusBg} size="sm" />
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{dayLabel(t.departureTime)} · {time(t.departureTime)} · {t.bus?.busNumber || ''}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Stat value={c.total ?? 0} label="Total" />
          <Stat value={c.boarded ?? 0} label="Boarded" color={colors.primary} />
          <Stat value={c.notBoarded ?? 0} label="To board" color={colors.muted} />
          <Stat value={c.cashPending ?? 0} label="Pay pending" color={c.cashPending ? colors.danger : colors.muted} />
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colors.slateSoft, borderRadius: radius.md, padding: 4, marginTop: 12 }}>
          {[['list', 'Passenger list', 'list'], ['seats', 'Seat map', 'grid']].map(([k, l, ic]) => (
            <Pressable key={k} onPress={() => setView(k)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: view === k ? '#fff' : 'transparent' }}>
              <Ionicons name={ic} size={16} color={view === k ? colors.primary : colors.muted} />
              <Text style={{ fontWeight: '800', color: view === k ? colors.primary : colors.muted }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {view === 'list' && (
        <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: colors.slateSoft, borderRadius: radius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Name, PNR, seat or phone" placeholderTextColor={colors.faint} autoCapitalize="none"
            style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text }} />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {FILTERS.map(([k, label]) => {
            const on = filter === k;
            const danger = k === 'pending' && countsFor.pending > 0;
            return (
              <Pressable key={k} onPress={() => setFilter(k)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? (danger ? colors.danger : colors.primary) : '#fff', borderWidth: 1, borderColor: on ? 'transparent' : danger ? colors.dangerLine : colors.border }}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: on ? '#fff' : danger ? colors.danger : colors.textSoft }}>{label}</Text>
                <Text style={{ fontWeight: '800', fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.faint }}>{countsFor[k]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        </>
        )}
        {offline ? <View style={{ marginTop: 10 }}><Banner text="Offline — showing the saved list. Actions sync automatically." /></View> : null}
        {error && !offline ? <View style={{ marginTop: 10 }}><Banner tone="danger" icon="alert-circle" text={error} /></View> : null}
      </View>

      {view === 'seats' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={Boolean(loading && manifest)} onRefresh={() => load()} tintColor={colors.primary} />}>
          {manifest ? (
            <SeatMap trip={manifest.trip} passengers={manifest.passengers || []} onSelect={(px) => setSelected({ bookingId: px.bookingId, seat: px.seatNumber })} />
          ) : <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />}
        </ScrollView>
      ) : (
      <SectionList
        sections={sections}
        keyExtractor={(p) => `${p.bookingId}-${p.seatNumber}`}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={Boolean(loading && manifest)} onRefresh={() => load()} tintColor={colors.primary} />}
        ListEmptyComponent={!manifest ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <EmptyState icon="people-outline" title={list.length ? 'No passengers match' : 'No passengers yet'} message={list.length ? 'Change the filter or search.' : 'Tickets sold for this bus will appear here.'} />
        )}
        renderSectionHeader={({ section }) => {
          const look = {
            drop: ['flag', colors.primary, colors.primarySoft],
            board: ['location', '#B45309', colors.warnSoft],
            noShow: ['close-circle', colors.danger, colors.dangerSoft],
            dropped: ['checkmark-done-circle', colors.success, colors.successSoft]
          }[section.kind] || ['location', colors.primary, colors.primarySoft];
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: look[2], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={look[0]} size={15} color={look[1]} />
              </View>
              <Text style={{ flex: 1, fontWeight: '900', color: section.kind === 'dropped' || section.kind === 'noShow' ? colors.muted : colors.text, fontSize: 14 }} numberOfLines={1}>{section.title}</Text>
              {section.time ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{pointTime(section.time)}</Text> : null}
              <Pill size="sm" label={String(section.data.length)} fg={look[1]} bg={look[2]} />
            </View>
          );
        }}
        renderItem={({ item: p, section }) => (
          <PassengerRow p={p} done={section.kind === 'dropped' || section.kind === 'noShow'} onPress={() => setSelected({ bookingId: p.bookingId, seat: p.seatNumber })} />
        )}
      />
      )}

      <TicketSheet
        visible={Boolean(ticket)}
        ticket={ticket}
        trip={manifest?.trip}
        focusSeat={selected?.seat}
        offline={offline}
        onClose={() => setSelected(null)}
        runAction={runAction}
      />
    </View>
  );
}

function Stat({ value, label, color = colors.text }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.slateSoft, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>{label}</Text>
    </View>
  );
}

function PassengerRow({ p, onPress, done }) {
  const pending = p.paymentStatus === 'PENDING' || p.payment === 'CASH_PENDING';
  const accent = done ? colors.border : p.journeyStatus === 'BOARDED' ? colors.primary : '#F59E0B';
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16, marginBottom: 8,
        backgroundColor: done ? '#F8FAFC' : pending ? '#fffafa' : '#fff',
        borderRadius: radius.lg, borderWidth: 1, borderColor: pending && !done ? colors.dangerLine : colors.border,
        borderLeftWidth: 4, borderLeftColor: pending && !done ? colors.danger : accent,
        padding: 12, opacity: pressed ? 0.85 : done ? 0.72 : 1
      })}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <SeatBadge seat={p.seatNumber} status={p.journeyStatus} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{p.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            {p.age} yrs · {genderShort(p.gender)}{p.isChild ? ' · Child' : ''}{p.infants?.length ? ` · +${p.infants.length} infant` : ''} · PNR {p.pnr}
          </Text>
        </View>
        <CallButton phone={p.phone} who={p.name} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <JourneyPill status={p.journeyStatus} size="sm" />
        <SourcePill bookedBy={p.bookedBy} agent={p.agent} size="sm" />
        <PaymentPill paymentStatus={p.paymentStatus} payment={p.payment} amountDue={p.amountDue} size="sm" />
      </View>
      {p.bookedBoardingPoint || p.bookedDroppingPoint ? (
        <Text style={{ color: colors.warn, fontSize: 12, fontWeight: '700', marginTop: 6 }}>
          <Ionicons name="swap-horizontal" size={12} /> {p.bookedBoardingPoint ? `Boards at ${p.boardingPoint?.name}` : ''}{p.bookedBoardingPoint && p.bookedDroppingPoint ? ' · ' : ''}{p.bookedDroppingPoint ? `Gets off at ${p.droppingPoint?.name}` : ''}
        </Text>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }} numberOfLines={1}>Drop: {p.droppingPoint?.name || '—'}</Text>
      )}
    </Pressable>
  );
}
