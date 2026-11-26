import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../api';
import { useTrip } from '../TripContext';
import { colors, radius, shadow, TRIP_STATUS } from '../theme';
import { addDays, dateKey, dayLabel, fromKey, monthShort, time, weekday } from '../format';
import { Banner, Button, EmptyState, Pill, ProgressBar } from '../components/ui';

const DAYS_BEFORE = 3;
const DAYS_TOTAL = 17;

/** Dashboard: pick a date, see your bus(es) for that day, open passengers or bus details. */
export default function HomeScreen({ user, onOpenPassengers, onOpenBus, onOpenProfile, onOpenHistory }) {
  const { trip: activeTrip, setTrip, pending } = useTrip();
  const [date, setDate] = useState(dateKey());
  const [trips, setTrips] = useState([]);
  const [calendar, setCalendar] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const stripRef = useRef(null);

  const days = useMemo(() => {
    const start = addDays(new Date(), -DAYS_BEFORE);
    return Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(start, i));
  }, []);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await api.calendar(dateKey(days[0]), DAYS_TOTAL);
      setCalendar(Object.fromEntries((res.days || []).map((d) => [d.date, d.trips])));
    } catch (e) { /* dots are optional */ }
  }, [days]);

  const loadTrips = useCallback(async (key, { pull } = {}) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await api.tripsForDate(key);
      setTrips(res.trips || []);
    } catch (e) {
      setError(e.code === 'OFFLINE' ? 'No internet. Your last opened bus is still available on the Passengers tab.' : e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);
  useEffect(() => { loadTrips(date); }, [date, loadTrips]);

  // Only one bus that day → select it automatically.
  useEffect(() => {
    if (trips.length === 1 && (!activeTrip || dateKey(activeTrip.departureTime) !== date)) setTrip(trips[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.header, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.headerSub, fontSize: 13, fontWeight: '700' }}>{greeting}</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }} numberOfLines={1}>{user?.name || 'Bus Manager'}</Text>
          </View>
          <Pressable onPress={onOpenHistory} accessibilityLabel="Trip history" hitSlop={6}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.headerChip, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={onOpenProfile} accessibilityLabel="Profile" hitSlop={6}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 15 }}>{String(user?.name || 'BM').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{monthShort(fromKey(date))} {fromKey(date).getFullYear()}</Text>
          {date !== dateKey() && (
            <Pressable onPress={() => { setDate(dateKey()); stripRef.current?.scrollTo({ x: 0, animated: true }); }} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Today</Text>
            </Pressable>
          )}
        </View>
        <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
          {days.map((d) => {
            const k = dateKey(d);
            const on = k === date;
            const isToday = k === dateKey();
            const count = calendar[k] || 0;
            return (
              <Pressable key={k} onPress={() => setDate(k)}
                style={{ width: 54, paddingVertical: 9, borderRadius: 14, alignItems: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.1)', borderWidth: isToday && !on ? 1 : 0, borderColor: '#a7f3d0' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: on ? colors.primary : colors.headerSub }}>{weekday(d).toUpperCase()}</Text>
                <Text style={{ fontSize: 19, fontWeight: '900', color: on ? colors.text : '#fff', marginTop: 1 }}>{d.getDate()}</Text>
                <View style={{ height: 6, marginTop: 3, flexDirection: 'row', gap: 2 }}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? colors.primary : '#FBBF24' }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => String(t._id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { loadCalendar(); loadTrips(date, { pull: true }); }} tintColor={colors.primary} />}
        ListHeaderComponent={(
          <View style={{ marginBottom: 12, gap: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>Your bus · {dayLabel(fromKey(date))}</Text>
            {pending > 0 && <Banner text={`${pending} action(s) waiting for internet — they will sync automatically.`} />}
            {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
          </View>
        )}
        ListEmptyComponent={loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <EmptyState icon="calendar-outline" title="No bus assigned on this date" message="Your company assigns trips to you. Pick another date above, or pull down to refresh." />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item: t }) => (
          <TripCard
            t={t}
            active={activeTrip?._id === t._id}
            onPassengers={() => { setTrip(t); onOpenPassengers(); }}
            onBus={() => { setTrip(t); onOpenBus(); }}
          />
        )}
      />
    </View>
  );
}

function TripCard({ t, active, onPassengers, onBus }) {
  const [label, fg, bg] = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
  const c = t.counts || {};
  const toBoard = c.notBoarded ?? 0;
  return (
    <View style={[{ backgroundColor: '#fff', borderRadius: radius.xl, borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.border, overflow: 'hidden' }, shadow]}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pill label={label} fg={fg} bg={bg} />
          {active ? <Pill label="Selected" fg={colors.primary} bg={colors.primarySoft} icon="checkmark" size="sm" /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{time(t.departureTime)}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSoft }} numberOfLines={1}>{t.from}</Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
            <Ionicons name="bus" size={20} color={colors.primary} />
            <View style={{ width: 70, height: 2, backgroundColor: colors.border, marginTop: 4 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{time(t.arrivalTime)}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSoft }} numberOfLines={1}>{t.to}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: colors.slateSoft, borderRadius: radius.md, padding: 10 }}>
          <Ionicons name="bus-outline" size={18} color={colors.muted} />
          <Text style={{ fontWeight: '900', color: colors.text, letterSpacing: 0.5 }}>{t.bus?.busNumber || '—'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>{t.bus?.busType || ''}</Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>{c.boarded ?? 0} / {c.total ?? 0} boarded</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{t.seatsBooked}/{t.seatsTotal} seats sold</Text>
          </View>
          <ProgressBar value={c.boarded ?? 0} total={c.total ?? 0} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <Pill size="sm" label={`${toBoard} yet to board`} icon="time-outline" />
            {c.noShow ? <Pill size="sm" label={`${c.noShow} no-show`} fg={colors.warn} bg={colors.warnSoft} /> : null}
            {c.cashPending ? <Pill size="sm" label={`${c.cashPending} payment pending`} fg={colors.danger} bg={colors.dangerSoft} icon="alert-circle" /> : null}
            {c.agentTickets ? <Pill size="sm" label={`${c.agentTickets} agent ticket(s)`} fg={colors.violet} bg={colors.violetSoft} /> : null}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingTop: 0 }}>
        <Button title="Passengers" icon="people" onPress={onPassengers} style={{ flex: 1.4 }} />
        <Button title="Bus details" icon="bus-outline" tone="outline" onPress={onBus} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
