import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { api, getAccessToken, wsUrl } from './api';
import { cacheManifest, cachedManifest, enqueue, flushQueue, newActionId, queuedActions } from './offline';

/**
 * The trip the manager is working on (chosen on the dashboard), its live passenger list,
 * and `runAction` which every board / no-show / drop / change-point / start / complete goes through.
 */
const TripCtx = createContext(null);

/** Optimistically apply an action to the cached manifest (used when offline). */
function applyLocal(manifest, type, payload) {
  const { bookingId, pnr, seatNumbers } = payload;
  const sameTicket = (p) => (bookingId && p.bookingId === bookingId) || (pnr && p.pnr === pnr);
  const seatOk = (p) => !seatNumbers?.length || seatNumbers.includes(p.seatNumber);
  const pointFrom = (list, id) => (list || []).find((x) => x.id === id);

  const passengers = manifest.passengers.map((p) => {
    if (!sameTicket(p)) return p;
    const next = { ...p };
    if (type === 'change-point' || type === 'board' || type === 'drop') {
      const bp = pointFrom(manifest.trip?.boardingPoints, payload.boardingPointId);
      const dp = pointFrom(manifest.trip?.droppingPoints, payload.droppingPointId) || pointFrom(manifest.trip?.boardingPoints, payload.droppingPointId);
      if (bp && bp.name !== p.boardingPoint?.name) { next.bookedBoardingPoint = p.bookedBoardingPoint || p.boardingPoint; next.boardingPoint = { name: bp.name, time: bp.time }; }
      if (dp && dp.name !== p.droppingPoint?.name) { next.bookedDroppingPoint = p.bookedDroppingPoint || p.droppingPoint; next.droppingPoint = { name: dp.name, time: dp.time }; }
    }
    if (!seatOk(p)) return next;
    if (type === 'board') { next.journeyStatus = 'BOARDED'; next.boardedAt = new Date().toISOString(); next.boardedAtPoint = next.boardingPoint?.name; }
    if (type === 'no-show') next.journeyStatus = 'NO_SHOW';
    if (type === 'drop') { next.journeyStatus = 'DROPPED'; next.droppedAt = new Date().toISOString(); next.droppedAtPoint = next.droppingPoint?.name; }
    return next;
  });
  const trip = { ...manifest.trip };
  if (type === 'start') trip.status = 'DEPARTED';
  if (type === 'complete') trip.status = 'COMPLETED';
  return { ...manifest, trip, passengers, counts: recount(passengers) };
}

function recount(passengers) {
  const c = { total: 0, boarded: 0, noShow: 0, dropped: 0, notBoarded: 0, cashPending: 0, infants: 0 };
  for (const p of passengers) {
    if (p.bookingStatus === 'CANCELLED') continue;
    c.total += 1;
    c.infants += p.infants?.length || 0;
    if (p.payment === 'CASH_PENDING') c.cashPending += 1;
    if (p.journeyStatus === 'BOARDED') c.boarded += 1;
    else if (p.journeyStatus === 'DROPPED') { c.dropped += 1; c.boarded += 1; }
    else if (p.journeyStatus === 'NO_SHOW') c.noShow += 1;
    else c.notBoarded += 1;
  }
  return c;
}

export function TripProvider({ children }) {
  const [trip, setTrip] = useState(null);          // trip card chosen on the dashboard
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const tripId = trip?._id;
  const loadSeq = useRef(0);

  const refreshPending = useCallback(async () => setPending((await queuedActions()).length), []);

  const load = useCallback(async ({ silent } = {}) => {
    if (!tripId) return;
    const seq = ++loadSeq.current;
    if (!silent) setLoading(true);
    try {
      await flushQueue().catch(() => null);
      await refreshPending();
      const res = await api.manifest(tripId);
      if (seq !== loadSeq.current) return;
      setManifest(res);
      setOffline(false);
      setError('');
      await cacheManifest(tripId, res);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (e.code === 'OFFLINE') {
        setOffline(true);
        const cached = await cachedManifest(tripId);
        if (cached) setManifest(cached);
      } else {
        setError(e.message);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [tripId, refreshPending]);

  useEffect(() => {
    setManifest(null);
    setError('');
    if (!tripId) return undefined;
    cachedManifest(tripId).then((c) => { if (c) setManifest((m) => m || c); }).catch(() => {});
    load();
    return undefined;
  }, [tripId, load]);

  // Live updates (cash received at the office, other devices, admin changes) + a slow safety poll.
  useEffect(() => {
    if (!tripId) return undefined;
    let ws;
    let timer;
    let closed = false;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          const token = getAccessToken();
          if (token) ws.send(JSON.stringify({ action: 'auth', token }));
          ws.send(JSON.stringify({ action: 'subscribe', room: `trip:${tripId}` }));
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (['TRIP_JOURNEY_UPDATE', 'PASSENGER_PAYMENT_CLEARED', 'SEATS_BOOKED', 'BOOKING_CANCELLED'].includes(msg.event)) load({ silent: true });
          } catch (e) { /* ignore */ }
        };
        ws.onclose = () => { if (!closed) timer = setTimeout(connect, 5000); };
      } catch (e) { /* offline */ }
    };
    connect();
    const poll = setInterval(() => load({ silent: true }), 60000);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(poll);
      try { if (ws) { ws.onclose = null; ws.close(); } } catch (e) { /* ignore */ }
    };
  }, [tripId, load]);

  /**
   * Run an action for the current trip. Pass the same clientActionId when retrying, so the server
   * applies it once. Offline: the action is queued and the list updated locally.
   * Throws on refusals (cash pending, wrong trip, …) so the confirmation sheet can show the reason.
   */
  const runAction = useCallback(async (type, payload = {}, clientActionId = newActionId()) => {
    if (!tripId) throw new Error('Choose your bus on the Home tab first.');
    try {
      const res = await api.action(tripId, type, { ...payload, clientActionId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load({ silent: true });
      return { ok: true, ...res };
    } catch (e) {
      if (e.code === 'OFFLINE') {
        await enqueue({ tripId, type, payload, clientActionId });
        await refreshPending();
        setOffline(true);
        setManifest((m) => {
          if (!m) return m;
          const next = applyLocal(m, type, payload);
          cacheManifest(tripId, next).catch(() => {});
          return next;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return { ok: true, offline: true };
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      throw e;
    }
  }, [tripId, load, refreshPending]);

  const value = useMemo(() => ({
    trip, setTrip, manifest, loading, offline, pending, error, load, runAction, refreshPending
  }), [trip, manifest, loading, offline, pending, error, load, runAction, refreshPending]);

  return <TripCtx.Provider value={value}>{children}</TripCtx.Provider>;
}

export const useTrip = () => useContext(TripCtx);
