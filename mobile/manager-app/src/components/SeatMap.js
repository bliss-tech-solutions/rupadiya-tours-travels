import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../theme';

/**
 * Live seat map of the bus. Every seat shows its state right now:
 *   to board  → amber with the passenger's initials (red edge = cash payment pending)
 *   on board  → brand blue, filled
 *   dropped   → empty again (small green tick) — the seat is free for the rest of the route
 *   no-show   → empty with a dashed rose edge
 *   free      → never sold / available
 * Layout comes from the trip's seats (row + column + deck): 2+2 seater, or 2+1 sleeper decks.
 */

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function seatState(p) {
  if (!p) return 'FREE';
  if (p.journeyStatus === 'BOARDED') return 'ON_BOARD';
  if (p.journeyStatus === 'DROPPED') return 'DROPPED';
  if (p.journeyStatus === 'NO_SHOW') return 'NO_SHOW';
  return 'TO_BOARD';
}

const STATE_STYLE = {
  FREE: { bg: colors.seatFree, border: colors.border, fg: colors.faint, dashed: false },
  TO_BOARD: { bg: colors.seatToBoard, border: '#F59E0B', fg: '#92400E', dashed: false },
  ON_BOARD: { bg: colors.seatOnBoard, border: colors.primaryDark, fg: '#FFFFFF', dashed: false },
  DROPPED: { bg: colors.seatFree, border: colors.successLine, fg: colors.faint, dashed: false },
  NO_SHOW: { bg: colors.seatFree, border: colors.dangerLine, fg: colors.faint, dashed: true }
};

export function seatCounts(seats, passengers) {
  const bySeat = new Map(passengers.map((p) => [String(p.seatNumber).toUpperCase(), p]));
  const c = { total: seats.length, onBoard: 0, toBoard: 0, free: 0 };
  for (const s of seats) {
    const st = seatState(bySeat.get(String(s.seatNumber).toUpperCase()));
    if (st === 'ON_BOARD') c.onBoard += 1;
    else if (st === 'TO_BOARD') c.toBoard += 1;
    else c.free += 1;
  }
  return c;
}

export default function SeatMap({ trip, passengers, onSelect }) {
  const seats = trip?.seats || [];
  const sleeper = trip?.layout === 'SLEEPER';
  const [deck, setDeck] = useState('LOWER');

  const active = useMemo(() => (passengers || []).filter((p) => p.bookingStatus !== 'CANCELLED'), [passengers]);
  const bySeat = useMemo(() => new Map(active.map((p) => [String(p.seatNumber).toUpperCase(), p])), [active]);
  const counts = useMemo(() => seatCounts(seats, active), [seats, active]);
  const hasUpper = seats.some((s) => String(s.deck || '').toUpperCase() === 'UPPER');

  const rows = useMemo(() => {
    const list = seats.filter((s) => !hasUpper || String(s.deck || 'LOWER').toUpperCase() === deck);
    const m = new Map();
    for (const s of list) {
      const r = s.row ?? 0;
      if (!m.has(r)) m.set(r, {});
      m.get(r)[String(s.column || '').toUpperCase()] = s;
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [seats, deck, hasUpper]);

  if (!seats.length) {
    return <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>Seat layout is not available for this bus.</Text>;
  }

  const tile = (seat, key) => {
    const w = sleeper ? 74 : 60;
    const h = sleeper ? 46 : 60;
    if (!seat) return <View key={key} style={{ width: w, height: h }} />;
    const p = bySeat.get(String(seat.seatNumber).toUpperCase());
    const st = seatState(p);
    const sty = STATE_STYLE[st];
    const cashPending = p && p.payment === 'CASH_PENDING' && st === 'TO_BOARD';
    const showPerson = st === 'TO_BOARD' || st === 'ON_BOARD';
    return (
      <Pressable
        key={key}
        onPress={p ? () => onSelect?.(p) : undefined}
        disabled={!p}
        accessibilityLabel={`Seat ${seat.seatNumber}: ${p ? `${p.name}, ${st.replace('_', ' ').toLowerCase()}` : 'free'}`}
        style={({ pressed }) => ({
          width: w, height: h, borderRadius: sleeper ? 10 : 12,
          backgroundColor: sty.bg,
          borderWidth: cashPending ? 2.5 : 1.5,
          borderColor: cashPending ? colors.danger : sty.border,
          borderStyle: sty.dashed ? 'dashed' : 'solid',
          alignItems: 'center', justifyContent: 'center',
          opacity: pressed ? 0.75 : 1
        })}
      >
        <Text style={{ position: 'absolute', top: 3, left: 5, fontSize: 9, fontWeight: '800', color: st === 'ON_BOARD' ? 'rgba(255,255,255,0.8)' : colors.faint }}>{seat.seatNumber}</Text>
        {showPerson ? (
          <>
            <Text style={{ fontSize: 15, fontWeight: '900', color: sty.fg, marginTop: 6 }}>{initials(p.name)}</Text>
            <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '700', color: sty.fg, maxWidth: w - 8, opacity: 0.9 }}>{String(p.name).split(' ')[0]}</Text>
          </>
        ) : st === 'DROPPED' ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 6 }} />
        ) : st === 'NO_SHOW' ? (
          <Ionicons name="close" size={15} color={colors.danger} style={{ marginTop: 6 }} />
        ) : (
          <Ionicons name={sleeper ? 'bed-outline' : 'square-outline'} size={14} color={colors.border} style={{ marginTop: 6 }} />
        )}
        {cashPending ? <View style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>₹</Text></View> : null}
      </Pressable>
    );
  };

  return (
    <View>
      {/* Live counters */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Counter value={counts.onBoard} label="On board" color={colors.primary} bg={colors.primarySoft} />
        <Counter value={counts.toBoard} label="To board" color="#B45309" bg={colors.warnSoft} />
        <Counter value={counts.free} label="Free now" color={colors.success} bg={colors.successSoft} />
      </View>

      {hasUpper && (
        <View style={{ flexDirection: 'row', backgroundColor: colors.slateSoft, borderRadius: radius.md, padding: 4, marginBottom: 12 }}>
          {['LOWER', 'UPPER'].map((d) => (
            <Pressable key={d} onPress={() => setDeck(d)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: deck === d ? '#fff' : 'transparent' }}>
              <Text style={{ fontWeight: '800', color: deck === d ? colors.primary : colors.muted }}>{d === 'LOWER' ? 'Lower deck' : 'Upper deck'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Bus body */}
      <View style={{ alignSelf: 'center', backgroundColor: '#fff', borderRadius: 26, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint, letterSpacing: 0.6 }}>{sleeper ? (deck === 'LOWER' ? 'LOWER DECK' : 'UPPER DECK') : 'FRONT'}</Text>
          <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="radio-button-on" size={14} color={colors.faint} />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {rows.map(([r, cols]) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {tile(cols.A, 'A')}
              {sleeper ? null : tile(cols.B, 'B')}
              <View style={{ width: sleeper ? 26 : 18 }} />
              {tile(cols.C, 'C')}
              {tile(cols.D, 'D')}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 14 }}>
        <Legend color={colors.seatToBoard} border="#F59E0B" label="To board" />
        <Legend color={colors.seatOnBoard} border={colors.primaryDark} label="On board" />
        <Legend color="#fff" border={colors.successLine} label="Dropped (free)" icon="checkmark-circle" iconColor={colors.success} />
        <Legend color="#fff" border={colors.dangerLine} label="No-show" dashed />
        <Legend color="#fff" border={colors.border} label="Free" />
        <Legend color={colors.seatToBoard} border={colors.danger} label="Cash pending" />
      </View>
      <Text style={{ textAlign: 'center', color: colors.faint, fontSize: 11, marginTop: 8 }}>Tap a passenger's seat to open the ticket.</Text>
    </View>
  );
}

function Counter({ value, label, color, bg }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>{label}</Text>
    </View>
  );
}

function Legend({ color, border, label, dashed, icon, iconColor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: 1.5, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center' }}>
        {icon ? <Ionicons name={icon} size={9} color={iconColor} /> : null}
      </View>
      <Text style={{ fontSize: 11, color: colors.textSoft, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
