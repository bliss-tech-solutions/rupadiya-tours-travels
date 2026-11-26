import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Offline support: buses often lose signal on highways.
 *  - The last manifest of each trip is cached, so the passenger list is always available.
 *  - Board / no-show / drop / start / complete actions are queued with a unique clientActionId and
 *    sent when the network returns. The server applies each clientActionId only once.
 */
const QUEUE_KEY = 'rbs_action_queue';
const manifestKey = (tripId) => `rbs_manifest_${tripId}`;

export function newActionId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function cacheManifest(tripId, manifest) {
  await AsyncStorage.setItem(manifestKey(tripId), JSON.stringify(manifest));
}

export async function cachedManifest(tripId) {
  const raw = await AsyncStorage.getItem(manifestKey(tripId));
  return raw ? JSON.parse(raw) : null;
}

export async function queuedActions() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(action) {
  const queue = await queuedActions();
  queue.push({ ...action, queuedAt: new Date().toISOString() });
  await saveQueue(queue);
}

/**
 * Try to send every queued action in order. Network errors stop the flush (try again later);
 * business errors (e.g. cash still pending) are dropped and reported back.
 */
export async function flushQueue() {
  const queue = await queuedActions();
  if (!queue.length) return { sent: 0, failed: [] };
  const remaining = [];
  const failed = [];
  let sent = 0;
  let offline = false;

  for (const item of queue) {
    if (offline) {
      remaining.push(item);
      continue;
    }
    try {
      await api.action(item.tripId, item.type, { ...item.payload, clientActionId: item.clientActionId });
      sent += 1;
    } catch (e) {
      if (e.code === 'OFFLINE' || e.status === 0 || e.status >= 500) {
        offline = true;
        remaining.push(item);
      } else {
        failed.push({ ...item, error: e.message });
      }
    }
  }
  await saveQueue(remaining);
  return { sent, failed, pending: remaining.length };
}
