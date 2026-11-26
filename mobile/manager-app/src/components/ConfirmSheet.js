import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Sheet from './Sheet';
import { Banner, Button } from './ui';
import { colors } from '../theme';

/**
 * Confirmation for an action. The confirm button runs `onConfirm` exactly once:
 * a ref lock blocks double taps, the sheet cannot close while it runs, and errors stay visible.
 * `onConfirm` returns true/undefined to close, or false to keep the sheet open.
 */
export default function ConfirmSheet({ visible, onClose, title, message, icon = 'help-circle', tone = 'primary', confirmLabel = 'Confirm', onConfirm, children }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (visible) { setError(''); lock.current = false; setRunning(false); }
  }, [visible]);

  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setRunning(true);
    setError('');
    try {
      const keepOpen = (await onConfirm?.()) === false;
      if (!keepOpen) onClose?.();
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };

  const iconColor = { danger: colors.danger, warn: colors.warn, blue: colors.blue, dark: colors.text }[tone] || colors.primary;
  const iconBg = { danger: colors.dangerSoft, warn: colors.warnSoft, blue: colors.blueSoft, dark: colors.slateSoft }[tone] || colors.primarySoft;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      locked={running}
      footer={(
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancel" tone="outline" onPress={onClose} disabled={running} style={{ flex: 1 }} />
          <Button title={confirmLabel} tone={tone === 'warn' ? 'warn' : tone} onPress={confirm} loading={running} style={{ flex: 1.4 }} />
        </View>
      )}
    >
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={32} color={iconColor} />
        </View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 12, textAlign: 'center' }}>{title}</Text>
        {message ? <Text style={{ fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      </View>
      {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
      {error ? <View style={{ marginTop: 12 }}><Banner tone="danger" icon="alert-circle" text={error} /></View> : null}
    </Sheet>
  );
}
