import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, shadowStrong } from '../theme';

export const TABS = [
  { key: 'home', label: 'Home', icon: 'home-outline', active: 'home' },
  { key: 'passengers', label: 'Passengers', icon: 'people-outline', active: 'people' },
  { key: 'scan', label: 'Scan', icon: 'qr-code-outline', active: 'qr-code' },
  { key: 'bus', label: 'Bus', icon: 'bus-outline', active: 'bus' },
  { key: 'history', label: 'History', icon: 'time-outline', active: 'time' }
];

/** Bottom navigation with a raised Scan button in the centre. */
export default function TabBar({ tab, onChange, badge }) {
  const insets = useSafeAreaInsets();
  const go = (key) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(key);
  };
  return (
    <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, flexDirection: 'row', alignItems: 'flex-end' }}>
      {TABS.map((t) => {
        const on = tab === t.key;
        if (t.key === 'scan') {
          return (
            <View key={t.key} style={{ flex: 1, alignItems: 'center' }}>
              <Pressable
                onPress={() => go('scan')}
                accessibilityRole="button"
                accessibilityLabel="Scan ticket QR"
                style={({ pressed }) => [{
                  width: 66, height: 66, borderRadius: 33, marginTop: -30,
                  backgroundColor: on ? colors.primaryDark : colors.primary,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 5, borderColor: '#fff', transform: [{ scale: pressed ? 0.94 : 1 }]
                }, shadowStrong]}
              >
                <Ionicons name="scan" size={30} color="#fff" />
              </Pressable>
              <Text style={{ fontSize: 11, fontWeight: '800', color: on ? colors.primary : colors.muted, marginTop: 2 }}>Scan</Text>
            </View>
          );
        }
        return (
          <Pressable key={t.key} onPress={() => go(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <View>
              <Ionicons name={on ? t.active : t.icon} size={24} color={on ? colors.primary : colors.faint} />
              {badge?.[t.key] ? (
                <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{badge[t.key] > 99 ? '99+' : badge[t.key]}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? colors.primary : colors.muted, marginTop: 3 }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
