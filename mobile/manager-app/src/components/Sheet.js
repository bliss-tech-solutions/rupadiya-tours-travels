import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../theme';

/**
 * Bottom sheet. While `locked` (an action is running) it cannot be closed by back button,
 * backdrop tap or the close icon, so an action can't be interrupted or started twice.
 */
export default function Sheet({ visible, onClose, title, subtitle, locked = false, children, footer, maxHeight = '92%' }) {
  const insets = useSafeAreaInsets();
  const close = () => { if (!locked) onClose?.(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }} onPress={close} />
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight, paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={close} hitSlop={10} disabled={locked} style={{ opacity: locked ? 0.3 : 1, padding: 4 }} accessibilityLabel="Close">
                <Ionicons name="close-circle" size={30} color={colors.faint} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
