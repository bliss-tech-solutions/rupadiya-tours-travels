import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { colors, radius, shadow, TRIP_STATUS } from '../theme';
import { addDays, dateKey, dayLabel, fromKey, time } from '../format';
import { Banner, EmptyState, Pill, ProgressBar } from '../components/ui';

const RANGES = [7, 30, 90];
const CACHE_KEY = 'rbs_history_cache';

/** Date-wise record of every bus this manager was assigned to and worked on. */
export default function HistoryScreen({ active }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ pull } = {}) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError('');
    const to = dateKey();
    const from = dateKey(addDays(new Date(), -(days - 1)));
    try {
      const res = await api.history(from, to);
      setData(res);
      setOffline(false);
      AsyncStorage.setItem(`${CACHE_KEY}_${days}`, JSON.stringify(res)).catch(() => {});
    } catch (e) {
      if (e.code === 'OFFLINE') {
        setOffline(true);
        const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${days}`).catch(() => null);
        if (cached) setData(JSON.parse(cached));
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { if (active) load(); }, [active, load]);

  const sum = data?.summary || {};
  const sections = (data?.days || []).map((d) => ({ title: d.date, totals: d.totals, data: d.trips }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.header, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ color: colors.headerSub, fontSize: 13, fontWeight: '700' }}>Your work record</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Trip history</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {RANGES.map((n) => (
            <Pressable key={n} onPress={() => setDays(n)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: days === n ? '#fff' : colors.headerChip }}>
              <Text style={{ fontWeight: '800', fontSize: 13, color: days === n ? colors.primary : '#fff' }}>Last {n} days</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <HeroStat value={sum.trips ?? '—'} label="Trips" />
          <HeroStat value={sum.passengers ?? '—'} label="Passengers" />
          <HeroStat value={sum.dropped ?? '—'} label="Dropped" />
          <HeroStat value={sum.buses ?? '—'} label="Buses" />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => String(t._id)}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={colors.primary} />}
        ListHeaderComponent={(
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            {offline ? <Banner text="Offline — showing your saved history." /> : null}
            {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
          </View>
        )}
        ListEmptyComponent={loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <EmptyState icon="time-outline" title="No trips in this period" message="Trips you run appear here day by day, with how many passengers boarded and were dropped." />
        )}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary, lineHeight: 17 }}>{fromKey(section.title).getDate()}</Text>
              <Text style={{ fontSize: 8, fontWeight: '800', color: colors.primary }}>{fromKey(section.title).toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.text, fontSize: 15 }}>{dayLabel(fromKey(section.title))}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{section.totals.trips} trip{section.totals.trips > 1 ? 's' : ''} · {section.totals.passengers} passengers · {section.totals.dropped} dropped</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => <TripCard t={item} />}
      />
    </View>
  );
}

function HeroStat({ value, label }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.headerChip, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.headerSub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function TripCard({ t }) {
  const [label, fg, bg] = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
  const c = t.counts || {};
  const seg = t.mySegments?.[0];
  return (
    <View style={[{ marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 14 }, shadow]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '900', color: colors.text }} numberOfLines={1}>{t.from} → {t.to}</Text>
        <Pill label={label} fg={fg} bg={bg} size="sm" />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.slateSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Ionicons name="bus" size={13} color={colors.primary} />
          <Text style={{ fontWeight: '900', color: colors.text, fontSize: 12, letterSpacing: 0.4 }}>{t.bus?.busNumber || '—'}</Text>
        </View>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }} numberOfLines={1}>{t.bus?.busType || ''}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700' }}>DEPARTURE</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{time(t.departureTime)}</Text>
          {t.startedAt ? <Text style={{ fontSize: 11, color: colors.muted }}>Started {time(t.startedAt)}</Text> : null}
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.faint} style={{ marginTop: 18 }} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700' }}>ARRIVAL</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{time(t.arrivalTime)}</Text>
          {t.completedAt ? <Text style={{ fontSize: 11, color: colors.success }}>Completed {time(t.completedAt)}</Text> : null}
        </View>
      </View>

      {t.role !== 'FULL' && seg ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: colors.violetSoft, borderRadius: 10, padding: 8 }}>
          <Ionicons name="swap-horizontal" size={14} color={colors.violet} />
          <Text style={{ flex: 1, color: colors.violet, fontWeight: '700', fontSize: 12 }}>
            {t.role === 'HANDED_OVER' ? `You ran ${seg.from} → ${seg.until}, then handed over` : `You took over at ${seg.from} → ${seg.until}`}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 13 }}>{c.dropped ?? 0} of {c.total ?? 0} dropped</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{t.seatsBooked}/{t.seatsTotal} seats sold</Text>
        </View>
        <ProgressBar value={c.dropped ?? 0} total={c.total ?? 0} color={colors.success} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill size="sm" icon="people" label={`${c.boarded ?? 0} boarded`} fg={colors.primary} bg={colors.primarySoft} />
          <Pill size="sm" icon="flag" label={`${c.dropped ?? 0} dropped`} fg={colors.success} bg={colors.successSoft} />
          {c.noShow ? <Pill size="sm" icon="close-circle" label={`${c.noShow} no-show`} fg={colors.danger} bg={colors.dangerSoft} /> : null}
        </View>
      </View>
    </View>
  );
}
