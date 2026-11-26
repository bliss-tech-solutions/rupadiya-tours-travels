import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, radius, JOURNEY } from '../theme';
import { formatPhone, rupees, telUrl } from '../format';

export function Pill({ label, fg = colors.muted, bg = colors.slateSoft, border, icon, size = 'md' }) {
  const small = size === 'sm';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 3 : 4, borderWidth: border ? 1 : 0, borderColor: border, alignSelf: 'flex-start' }}>
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '800', fontSize: small ? 11 : 12 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function JourneyPill({ status, size }) {
  const [label, fg, bg, border] = JOURNEY[status] || JOURNEY.NOT_BOARDED;
  const icon = { NOT_BOARDED: 'time-outline', BOARDED: 'checkmark-circle', NO_SHOW: 'close-circle', DROPPED: 'flag' }[status] || 'time-outline';
  return <Pill label={label} fg={fg} bg={bg} border={border} icon={icon} size={size} />;
}

/** "Payment complete" (green) or "Payment pending ₹X" (red), as the manager must see at a glance. */
export function PaymentPill({ paymentStatus, payment, amountDue, size }) {
  if (paymentStatus === 'PENDING' || payment === 'CASH_PENDING') {
    return <Pill label={`Payment pending${amountDue ? ` ${rupees(amountDue)}` : ''}`} fg={colors.danger} bg={colors.dangerSoft} border={colors.dangerLine} icon="alert-circle" size={size} />;
  }
  return <Pill label={payment === 'CASH_RECEIVED' ? 'Paid (cash)' : 'Payment complete'} fg={colors.success} bg={colors.successSoft} border={colors.successLine} icon="checkmark-done" size={size} />;
}

export function SourcePill({ bookedBy, agent, size }) {
  if (bookedBy === 'AGENT') {
    return <Pill label={`Agent${agent?.name ? ` · ${agent.name}` : ''}`} fg={colors.violet} bg={colors.violetSoft} border={colors.violetLine} icon="briefcase" size={size} />;
  }
  return <Pill label="Online booking" fg={colors.blue} bg={colors.blueSoft} border={colors.blueLine} icon="globe-outline" size={size} />;
}

export function Button({ title, onPress, loading, disabled, tone = 'primary', icon, style, small, block = true }) {
  const tones = {
    primary: [colors.primary, '#fff', colors.primary],
    danger: [colors.danger, '#fff', colors.danger],
    blue: [colors.blue, '#fff', colors.blue],
    dark: [colors.text, '#fff', colors.text],
    warn: [colors.warn, '#fff', colors.warn],
    outline: ['#fff', colors.text, colors.border],
    ghost: ['transparent', colors.primary, 'transparent']
  };
  const [bg, fg, border] = tones[tone] || tones.primary;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.md,
        paddingVertical: small ? 9 : 13, paddingHorizontal: small ? 12 : 16,
        opacity: off ? 0.55 : pressed ? 0.85 : 1, alignSelf: block ? 'stretch' : 'flex-start'
      }, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '800', fontSize: small ? 13 : 15 }}>{loading ? 'Please wait…' : title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.primary, bg = colors.primarySoft, size = 40, label, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={size * 0.48} color={color} />
    </Pressable>
  );
}

export function callNumber(phone, who = 'this number') {
  const url = telUrl(phone);
  if (!url) {
    Alert.alert('No phone number', `There is no valid phone number for ${who}.`);
    return;
  }
  Haptics.selectionAsync().catch(() => {});
  Linking.openURL(url).catch(() => Alert.alert('Cannot call', `Dial ${formatPhone(phone)} manually.`));
}

export function CallButton({ phone, who, size = 40, tone = 'primary' }) {
  const t = tone === 'blue' ? [colors.blue, colors.blueSoft] : tone === 'violet' ? [colors.violet, colors.violetSoft] : tone === 'danger' ? [colors.danger, colors.dangerSoft] : [colors.primary, colors.primarySoft];
  return <IconButton icon="call" color={t[0]} bg={t[1]} size={size} label={`Call ${who || ''}`} disabled={!telUrl(phone)} onPress={() => callNumber(phone, who)} />;
}

/** A contact line with name, number and a call button. */
export function ContactRow({ icon = 'person-circle-outline', title, subtitle, phone, who, tone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Ionicons name={icon} size={26} color={colors.faint} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{[subtitle, phone ? formatPhone(phone) : null].filter(Boolean).join(' · ') || '—'}</Text>
      </View>
      {phone ? <CallButton phone={phone} who={who || title} tone={tone} /> : null}
    </View>
  );
}

export function SectionTitle({ title, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.faint, letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</Text>
      {right}
    </View>
  );
}

export function InfoRow({ icon, label, value, valueColor, last }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: last ? 0 : 1, borderColor: colors.divider }}>
      {icon ? <Ionicons name={icon} size={17} color={colors.faint} style={{ marginTop: 1 }} /> : null}
      <Text style={{ width: 110, color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ flex: 1, color: valueColor || colors.text, fontWeight: '700', fontSize: 13 }}>{value || '—'}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'bus-outline', title, message, action }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {message ? <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Banner({ tone = 'warn', icon = 'cloud-offline-outline', text }) {
  const t = { warn: [colors.warn, colors.warnSoft, colors.warnLine], danger: [colors.danger, colors.dangerSoft, colors.dangerLine], info: [colors.blue, colors.blueSoft, colors.blueLine] }[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: t[1], borderColor: t[2], borderWidth: 1, borderRadius: radius.md, padding: 10 }}>
      <Ionicons name={icon} size={18} color={t[0]} />
      <Text style={{ flex: 1, color: t[0], fontWeight: '700', fontSize: 13 }}>{text}</Text>
    </View>
  );
}

/** Seat badge coloured by journey status. */
export function SeatBadge({ seat, status, size = 46 }) {
  const [, fg, bg, border] = JOURNEY[status] || JOURNEY.NOT_BOARDED;
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: bg, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color: fg, opacity: 0.8 }}>SEAT</Text>
      <Text style={{ fontSize: String(seat).length > 3 ? 13 : 16, fontWeight: '900', color: fg }} numberOfLines={1}>{seat}</Text>
    </View>
  );
}

export function ProgressBar({ value, total, color = colors.primary }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View style={{ height: 8, backgroundColor: colors.slateSoft, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}
