import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Sheet from './Sheet';
import { Banner, Button, ContactRow, InfoRow, JourneyPill, PaymentPill, Pill, SectionTitle, SeatBadge, SourcePill } from './ui';
import { colors, radius } from '../theme';
import { dateTime, genderShort, pointTime, rupees } from '../format';
import { newActionId } from '../offline';

const BOARD_REASONS = ['Passenger was late', 'Passenger asked', 'Pickup point changed'];
const DROP_REASONS = ['Passenger asked to get off earlier', 'Passenger going further', 'Drop point changed'];

/**
 * Full ticket view (from a QR scan or from the passenger list) with every manager action.
 * Each action shows a confirmation step inside the sheet; the confirm button is locked while it runs.
 *
 * ticket: { bookingId, pnr, qrToken?, passengers[], boardingPoint, droppingPoint, bookedBoardingPoint?, bookedDroppingPoint?,
 *           phone, emergencyContact, agent, bookedBy, payment, paymentStatus, paymentMode, amountDue, totalFare, canBoard, status }
 */
export default function TicketSheet({ visible, onClose, ticket, trip, focusSeat, runAction, onAfterAction, offline }) {
  const [mode, setMode] = useState('details');
  const [seats, setSeats] = useState([]);
  const [pointId, setPointId] = useState(null);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const actionId = useRef(null);

  useEffect(() => {
    if (visible) { setMode('details'); setError(''); setNotice(''); }
  }, [visible, ticket?.bookingId]);

  const tripStatus = trip?.status;
  const tripOpen = !['COMPLETED', 'CANCELLED'].includes(tripStatus);
  const passengers = ticket?.passengers || [];
  const waiting = passengers.filter((p) => ['NOT_BOARDED', 'NO_SHOW'].includes(p.journeyStatus));
  const onBoard = passengers.filter((p) => p.journeyStatus === 'BOARDED');
  const boardingPoints = trip?.boardingPoints || [];
  const droppingPoints = (trip?.droppingPoints?.length ? trip.droppingPoints : boardingPoints) || [];
  const cashPending = ticket?.payment === 'CASH_PENDING' || ticket?.paymentStatus === 'PENDING';
  const canBoard = Boolean(ticket?.canBoard) && !cashPending && ticket?.status !== 'CANCELLED';

  const findByName = (list, name) => list.find((p) => p.name?.toLowerCase() === String(name || '').toLowerCase());
  const currentBoarding = findByName(boardingPoints, ticket?.boardingPoint?.name);
  const currentDropping = findByName(droppingPoints, ticket?.droppingPoint?.name);

  const open = (next) => {
    setError('');
    setNotice('');
    setReason('');
    setOtherReason('');
    actionId.current = newActionId(); // same id for retries of this confirmation → applied once
    if (next === 'board') {
      // From the passenger list only the tapped seat is selected; from a QR scan the whole ticket is.
      const focus = waiting.find((p) => p.seatNumber === focusSeat);
      setSeats(focus ? [focus.seatNumber] : waiting.map((p) => p.seatNumber));
      setPointId(currentBoarding?.id || boardingPoints[0]?.id || null);
    } else if (next === 'move') {
      const idx = boardingPoints.findIndex((p) => p.id === currentBoarding?.id);
      setPointId(boardingPoints[idx + 1]?.id || null);
    } else if (next === 'noshow') {
      const notBoarded = passengers.filter((p) => p.journeyStatus === 'NOT_BOARDED');
      const focus = notBoarded.find((p) => p.seatNumber === focusSeat);
      setSeats(focus ? [focus.seatNumber] : notBoarded.map((p) => p.seatNumber));
    } else if (next === 'drop') {
      const focus = onBoard.find((p) => p.seatNumber === focusSeat);
      setSeats(focus ? [focus.seatNumber] : onBoard.map((p) => p.seatNumber));
      setPointId(currentDropping?.id || droppingPoints[droppingPoints.length - 1]?.id || null);
    } else if (next === 'changeDrop') {
      setPointId(null);
    }
    setMode(next);
  };

  const pointChanged = (() => {
    if (mode === 'board') return pointId && currentBoarding && pointId !== currentBoarding.id;
    if (mode === 'drop') return pointId && currentDropping && pointId !== currentDropping.id;
    if (mode === 'move') return Boolean(pointId) && pointId !== currentBoarding?.id;
    if (mode === 'changeDrop') return Boolean(pointId) && pointId !== currentDropping?.id;
    return false;
  })();
  const finalReason = reason === 'Other' ? otherReason.trim() : reason;
  const needsReason = pointChanged && !finalReason;

  const confirm = async () => {
    if (lock.current) return;
    if (['board', 'noshow', 'drop'].includes(mode) && seats.length === 0) { setError('Select at least one seat.'); return; }
    if (['move', 'changeDrop'].includes(mode) && !pointChanged) { setError('Choose a different stop.'); return; }
    if (needsReason) { setError('Choose why the stop is changing — it is sent to the passenger, company and RBS.'); return; }
    lock.current = true;
    setRunning(true);
    setError('');
    const base = { pnr: ticket.pnr, bookingId: ticket.bookingId, ...(ticket.qrToken ? { qrToken: ticket.qrToken } : {}) };
    try {
      let res;
      if (mode === 'board') {
        res = await runAction('board', { ...base, seatNumbers: seats, ...(pointChanged ? { boardingPointId: pointId, reason: finalReason } : {}) }, actionId.current);
      } else if (mode === 'move') {
        res = await runAction('change-point', { ...base, boardingPointId: pointId, reason: finalReason }, actionId.current);
      } else if (mode === 'noshow') {
        res = await runAction('no-show', { ...base, seatNumbers: seats }, actionId.current);
      } else if (mode === 'drop') {
        res = await runAction('drop', { ...base, seatNumbers: seats, ...(pointChanged ? { droppingPointId: pointId, reason: finalReason } : {}) }, actionId.current);
      } else if (mode === 'changeDrop') {
        res = await runAction('change-point', { ...base, droppingPointId: pointId, reason: finalReason }, actionId.current);
      }
      const done = {
        board: `Boarded seat${seats.length > 1 ? 's' : ''} ${seats.join(', ')}.`,
        move: 'Boarding stop changed. WhatsApp sent to passenger, company and RBS.',
        noshow: `Seat${seats.length > 1 ? 's' : ''} ${seats.join(', ')} marked no-show.`,
        drop: `Dropped seat${seats.length > 1 ? 's' : ''} ${seats.join(', ')}.`,
        changeDrop: 'Drop stop changed. WhatsApp sent to passenger, company and RBS.'
      }[mode];
      setNotice(res?.offline ? `${done} Saved offline — it syncs when the network returns.` : done);
      setMode('details');
      await onAfterAction?.();
    } catch (e) {
      setError(e.message || 'Action failed. Please try again.');
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };

  const toggleSeat = (seat) => setSeats((list) => (list.includes(seat) ? list.filter((x) => x !== seat) : [...list, seat]));

  if (!ticket) return null;

  const titles = {
    details: `PNR ${ticket.pnr}`,
    board: 'Board passengers',
    move: 'Move to another boarding stop',
    noshow: 'Mark as no-show',
    drop: 'Drop passengers',
    changeDrop: 'Change drop stop'
  };

  const footer = mode === 'details' ? (
    <View style={{ gap: 8 }}>
      {tripOpen && waiting.length > 0 && (
        canBoard
          ? <Button title={`Board ${waiting.length > 1 ? `${waiting.length} passengers` : 'passenger'}`} icon="checkmark-circle" onPress={() => open('board')} />
          : <Button title={cashPending ? 'Payment pending — do not board' : 'Cannot board this ticket'} tone="danger" icon="hand-left" disabled />
      )}
      {tripOpen && onBoard.length > 0 && <Button title={`Drop ${onBoard.length > 1 ? `${onBoard.length} passengers` : 'passenger'}`} tone="blue" icon="flag" onPress={() => open('drop')} />}
      {tripOpen && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {waiting.length > 0 && boardingPoints.length > 1 && <Button small title="Next stop (late)" tone="outline" icon="time-outline" onPress={() => open('move')} style={{ flex: 1 }} />}
          {passengers.some((p) => p.journeyStatus !== 'DROPPED') && droppingPoints.length > 1 && <Button small title="Change drop" tone="outline" icon="swap-vertical" onPress={() => open('changeDrop')} style={{ flex: 1 }} />}
          {passengers.some((p) => p.journeyStatus === 'NOT_BOARDED') && <Button small title="No-show" tone="outline" icon="close-circle-outline" onPress={() => open('noshow')} style={{ flex: 1 }} />}
        </View>
      )}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button title="Back" tone="outline" onPress={() => { setMode('details'); setError(''); }} disabled={running} style={{ flex: 1 }} />
      <Button
        title={{ board: 'Confirm boarding', move: 'Confirm stop change', noshow: 'Confirm no-show', drop: 'Confirm drop', changeDrop: 'Confirm drop change' }[mode]}
        tone={mode === 'noshow' ? 'warn' : mode === 'drop' ? 'blue' : 'primary'}
        loading={running}
        onPress={confirm}
        style={{ flex: 1.6 }}
      />
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} locked={running} title={titles[mode]} subtitle={mode === 'details' ? `${passengers.length} passenger${passengers.length > 1 ? 's' : ''} · ${trip?.from || ''} → ${trip?.to || ''}` : `PNR ${ticket.pnr}`} footer={footer}>
      {notice ? <View style={{ marginBottom: 10 }}><Banner tone="info" icon="checkmark-circle" text={notice} /></View> : null}
      {offline && mode !== 'details' ? <View style={{ marginBottom: 10 }}><Banner text="Offline — this action will be saved and synced later." /></View> : null}

      {mode === 'details' && (
        <>
          {cashPending && (
            <View style={{ backgroundColor: colors.danger, borderRadius: radius.md, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="hand-left" size={26} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>DO NOT BOARD — payment pending</Text>
                <Text style={{ color: '#ffe4e6', fontSize: 13, marginTop: 2 }}>The agent has not paid {ticket.amountDue ? rupees(ticket.amountDue) : 'the cash'} to the company office yet.</Text>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <SourcePill bookedBy={ticket.bookedBy} agent={ticket.agent} />
            <PaymentPill paymentStatus={ticket.paymentStatus} payment={ticket.payment} amountDue={ticket.amountDue} />
            {ticket.status === 'CANCELLED' && <Pill label="Cancelled" fg={colors.danger} bg={colors.dangerSoft} icon="close" />}
          </View>

          <SectionTitle title="Passengers" />
          <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            {passengers.map((p, i) => (
              <View key={p.seatNumber} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.divider, backgroundColor: p.seatNumber === focusSeat ? '#f8fffb' : 'transparent' }}>
                <SeatBadge seat={p.seatNumber} status={p.journeyStatus} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{p.age} yrs · {genderShort(p.gender)}{p.isChild ? ' · Child' : ''}</Text>
                  {(p.infants || []).map((inf, k) => (
                    <Text key={k} style={{ color: colors.blue, fontSize: 12, fontWeight: '600' }}>+ Infant on lap: {inf.name} ({inf.age} yr)</Text>
                  ))}
                  {p.boardedAt ? <Text style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>Boarded {dateTime(p.boardedAt)}{p.boardedAtPoint ? ` at ${p.boardedAtPoint}` : ''}</Text> : null}
                  {p.droppedAt ? <Text style={{ color: colors.blue, fontSize: 11 }}>Dropped {dateTime(p.droppedAt)}{p.droppedAtPoint ? ` at ${p.droppedAtPoint}` : ''}</Text> : null}
                </View>
                <JourneyPill status={p.journeyStatus} size="sm" />
              </View>
            ))}
          </View>

          <SectionTitle title="Journey" />
          <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <PointLine icon="ellipse" color={colors.primary} label="Boarding" point={ticket.boardingPoint} booked={ticket.bookedBoardingPoint} />
            <View style={{ width: 2, height: 16, backgroundColor: colors.border, marginLeft: 6, marginVertical: 2 }} />
            <PointLine icon="location" color={colors.danger} label="Dropping" point={ticket.droppingPoint} booked={ticket.bookedDroppingPoint} />
          </View>

          <SectionTitle title="Contacts" />
          <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            <ContactRow icon="person-circle-outline" title={passengers[0]?.name || 'Passenger'} subtitle="Booking contact" phone={ticket.phone} who="the passenger" />
            {ticket.emergencyContact?.phone ? (
              <View style={{ borderTopWidth: 1, borderColor: colors.divider }}>
                <ContactRow icon="medkit-outline" title={`${ticket.emergencyContact.name}`} subtitle={`Emergency · ${ticket.emergencyContact.relation || ''}`} phone={ticket.emergencyContact.phone} who="the emergency contact" tone="danger" />
              </View>
            ) : null}
            {ticket.agent ? (
              <View style={{ borderTopWidth: 1, borderColor: colors.divider }}>
                <ContactRow icon="briefcase-outline" title={ticket.agent.name} subtitle={`Agent${ticket.agent.agency ? ` · ${ticket.agent.agency}` : ''}`} phone={ticket.agent.phone} who="the agent" tone="violet" />
              </View>
            ) : null}
          </View>

          <SectionTitle title="Ticket" />
          <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
            <InfoRow icon="ticket-outline" label="PNR" value={ticket.pnr} />
            <InfoRow icon="cart-outline" label="Booked by" value={ticket.bookedBy === 'AGENT' ? `Agent ${ticket.agent?.name || ''}${ticket.agent?.code ? ` (${ticket.agent.code})` : ''}` : 'Customer (online)'} />
            <InfoRow icon="card-outline" label="Payment" value={`${ticket.paymentStatus === 'PENDING' ? 'Pending' : 'Complete'} · ${ticket.paymentMode === 'CASH' ? 'Cash via agent' : ticket.paymentMode === 'WALLET' ? 'Agent wallet' : 'Online'}`} valueColor={ticket.paymentStatus === 'PENDING' ? colors.danger : colors.primary} />
            {ticket.totalFare ? <InfoRow icon="cash-outline" label="Ticket total" value={rupees(ticket.totalFare)} last={!ticket.amountDue} /> : null}
            {ticket.amountDue ? <InfoRow icon="alert-circle-outline" label="Amount due" value={rupees(ticket.amountDue)} valueColor={colors.danger} last /> : null}
          </View>

          {ticket.journeyLog?.length ? (
            <>
              <SectionTitle title="Changes on the bus" />
              {ticket.journeyLog.map((l, i) => (
                <Text key={i} style={{ color: colors.textSoft, fontSize: 13, marginBottom: 4 }}>
                  • {l.type === 'DROPPING' ? 'Drop' : 'Boarding'}: {l.from ? `${l.from} → ` : ''}{l.to}{l.reason ? ` (${l.reason})` : ''}
                </Text>
              ))}
            </>
          ) : null}
          <View style={{ height: 8 }} />
        </>
      )}

      {['board', 'noshow', 'drop'].includes(mode) && (
        <>
          <SectionTitle title="Seats" right={<Text style={{ color: colors.muted, fontSize: 12 }}>{seats.length} selected</Text>} />
          {(mode === 'board' ? waiting : mode === 'drop' ? onBoard : passengers.filter((p) => p.journeyStatus === 'NOT_BOARDED')).map((p) => {
            const on = seats.includes(p.seatNumber);
            return (
              <Pressable key={p.seatNumber} onPress={() => toggleSeat(p.seatNumber)} disabled={running}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : '#fff' }}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.primary : colors.faint} />
                <Text style={{ fontWeight: '900', fontSize: 16, width: 44, color: colors.text }}>{p.seatNumber}</Text>
                <Text style={{ flex: 1, fontWeight: '700', color: colors.text }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{p.age} · {genderShort(p.gender)}</Text>
              </Pressable>
            );
          })}
        </>
      )}

      {['board', 'move'].includes(mode) && (
        <>
          <SectionTitle title={mode === 'board' ? 'Boarding at' : 'Passenger will board at'} />
          <PointPicker points={boardingPoints} selected={pointId} onSelect={setPointId} bookedName={(ticket.bookedBoardingPoint || ticket.boardingPoint)?.name} currentName={ticket.boardingPoint?.name} disabled={running} hideCurrent={mode === 'move'} />
        </>
      )}
      {['drop', 'changeDrop'].includes(mode) && (
        <>
          <SectionTitle title={mode === 'drop' ? 'Getting off at' : 'Passenger will get off at'} />
          <PointPicker points={droppingPoints} selected={pointId} onSelect={setPointId} bookedName={(ticket.bookedDroppingPoint || ticket.droppingPoint)?.name} currentName={ticket.droppingPoint?.name} disabled={running} hideCurrent={mode === 'changeDrop'} />
        </>
      )}

      {pointChanged && (
        <>
          <SectionTitle title="Reason" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...(['board', 'move'].includes(mode) ? BOARD_REASONS : DROP_REASONS), 'Other'].map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} disabled={running}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: reason === r ? colors.primary : colors.border, backgroundColor: reason === r ? colors.primarySoft : '#fff' }}>
                <Text style={{ fontWeight: '700', color: reason === r ? colors.primary : colors.textSoft, fontSize: 13 }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          {reason === 'Other' && (
            <TextInput value={otherReason} onChangeText={setOtherReason} maxLength={150} placeholder="Write the reason" placeholderTextColor={colors.faint}
              style={{ marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: '#fff', color: colors.text }} />
          )}
          <View style={{ marginTop: 12 }}>
            <Banner tone="info" icon="logo-whatsapp" text="The passenger, the company and RBS will get a WhatsApp message about this change." />
          </View>
        </>
      )}

      {mode === 'board' && !pointChanged && (
        <View style={{ marginTop: 12 }}><Banner tone="info" icon="id-card-outline" text="Check the passenger's photo ID before boarding." /></View>
      )}
      {mode === 'noshow' && (
        <View style={{ marginTop: 12 }}><Banner text="Use no-show only when the passenger did not come. If they are late, use “Next stop (late)” instead." /></View>
      )}

      {error ? <View style={{ marginTop: 12 }}><Banner tone="danger" icon="alert-circle" text={error} /></View> : null}
    </Sheet>
  );
}

function PointLine({ icon, color, label, point, booked }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Ionicons name={icon} size={14} color={color} style={{ marginTop: 3 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.faint, textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{point?.name || '—'}</Text>
        {point?.time ? <Text style={{ fontSize: 12, color: colors.muted }}>{pointTime(point.time)}</Text> : null}
        {booked?.name ? <Text style={{ fontSize: 12, color: colors.warn, fontWeight: '700', marginTop: 2 }}>Changed on the bus · booked: {booked.name}</Text> : null}
      </View>
    </View>
  );
}

function PointPicker({ points, selected, onSelect, bookedName, currentName, disabled, hideCurrent }) {
  if (!points.length) return <Text style={{ color: colors.muted }}>No stops are set up for this route.</Text>;
  return points.map((p) => {
    if (hideCurrent && p.name === currentName) return null;
    const on = selected === p.id;
    const isBooked = p.name === bookedName;
    return (
      <Pressable key={p.id} onPress={() => onSelect(p.id)} disabled={disabled}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : '#fff' }}>
        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.faint} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>{p.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{[pointTime(p.time), p.landmark].filter(Boolean).join(' · ')}</Text>
        </View>
        {isBooked ? <Pill label="Booked" size="sm" fg={colors.blue} bg={colors.blueSoft} /> : null}
        {!isBooked && p.name === currentName ? <Pill label="Current" size="sm" fg={colors.warn} bg={colors.warnSoft} /> : null}
      </Pressable>
    );
  });
}

/** Builds the ticket object for TicketSheet from manifest rows of one booking. */
export function ticketFromManifest(manifest, bookingId) {
  const rows = (manifest?.passengers || []).filter((p) => p.bookingId === bookingId);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    bookingId,
    pnr: r.pnr,
    status: r.bookingStatus,
    passengers: rows,
    boardingPoint: r.boardingPoint,
    droppingPoint: r.droppingPoint,
    bookedBoardingPoint: r.bookedBoardingPoint,
    bookedDroppingPoint: r.bookedDroppingPoint,
    phone: r.phone,
    emergencyContact: r.emergencyContact,
    agent: r.agent,
    bookedBy: r.bookedBy,
    payment: r.payment,
    paymentStatus: r.paymentStatus,
    paymentMode: r.paymentMode,
    amountDue: r.amountDue,
    totalFare: r.totalFare,
    canBoard: r.canBoard
  };
}
