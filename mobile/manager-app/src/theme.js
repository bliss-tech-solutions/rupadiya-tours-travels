import { Platform, StyleSheet } from 'react-native';

export const colors = {
  bg: '#F3F6FB',
  card: '#ffffff',
  border: '#E2E8F0',
  divider: '#EEF2F7',
  text: '#0F172A',
  textSoft: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',

  // Brand blue (same as the boarding pass)
  primary: '#1456C8',
  primaryDark: '#0E3F96',
  primarySoft: '#EAF1FF',
  primaryLine: '#BFD3FA',

  // Navy header and the text used on it
  header: '#0B1F4B',
  headerSub: '#9DB8F2',
  headerChip: 'rgba(255,255,255,0.10)',

  // "Done" states: paid, dropped, completed
  success: '#059669',
  successSoft: '#ECFDF5',
  successLine: '#A7F3D0',

  danger: '#E11D48',
  dangerSoft: '#FFF1F2',
  dangerLine: '#FECDD3',
  warn: '#D97706',
  warnSoft: '#FFFBEB',
  warnLine: '#FDE68A',
  blue: '#0EA5E9',
  blueSoft: '#F0F9FF',
  blueLine: '#BAE6FD',
  violet: '#7C3AED',
  violetSoft: '#F5F3FF',
  violetLine: '#DDD6FE',
  slateSoft: '#F1F5F9',

  // Seat map
  seatFree: '#FFFFFF',
  seatToBoard: '#FEF3C7',
  seatOnBoard: '#1456C8',
  seatDropped: '#F0FDF4'
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const shadow = Platform.select({
  ios: { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 3 }
});

export const shadowStrong = Platform.select({
  ios: { shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  default: { elevation: 8 }
});

/** Journey status → [label, text colour, background, border] */
export const JOURNEY = {
  NOT_BOARDED: ['Yet to board', colors.muted, colors.slateSoft, colors.border],
  BOARDED: ['On board', colors.primary, colors.primarySoft, colors.primaryLine],
  NO_SHOW: ['No-show', colors.warn, colors.warnSoft, colors.warnLine],
  DROPPED: ['Dropped', colors.success, colors.successSoft, colors.successLine]
};

export const TRIP_STATUS = {
  SCHEDULED: ['Scheduled', colors.muted, colors.slateSoft],
  BOARDING: ['Boarding', colors.warn, colors.warnSoft],
  DEPARTED: ['On the road', colors.primary, colors.primarySoft],
  COMPLETED: ['Completed', colors.success, colors.successSoft],
  CANCELLED: ['Cancelled', colors.danger, colors.dangerSoft]
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text },
  h3: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
  label: { fontSize: 11, fontWeight: '800', color: colors.faint, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  btn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutline: { borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  btnOutlineText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }
});
