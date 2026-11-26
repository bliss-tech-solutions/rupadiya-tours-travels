import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { api, getApiBase, setServerUrl } from '../api';
import { s, colors } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [server, setServer] = useState(getApiBase());
  const [serverOpen, setServerOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState(getApiBase());
  const [serverStatus, setServerStatus] = useState(null); // { ok, text }
  const [testing, setTesting] = useState(false);

  const passwordRef = useRef(null);
  const cleanEmail = email.trim().toLowerCase();
  const canSubmit = EMAIL_RE.test(cleanEmail) && password.length > 0 && !busy;

  const submit = async () => {
    if (busy) return;
    if (!EMAIL_RE.test(cleanEmail)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    Keyboard.dismiss();
    setBusy(true);
    setError('');
    try {
      const user = await api.login(cleanEmail, password);
      onLoggedIn(user);
    } catch (e) {
      setError(e.message || 'Sign in failed. Please try again.');
      if (e.code === 'OFFLINE') setServerOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const testServer = async (url) => {
    setTesting(true);
    setServerStatus(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      setServerStatus(res.ok ? { ok: true, text: 'Connected to the server.' } : { ok: false, text: `Server answered with error ${res.status}.` });
    } catch {
      setServerStatus({ ok: false, text: 'Cannot reach this address from the phone. Same Wi-Fi? API running? Firewall open for port 4500?' });
    } finally {
      clearTimeout(timer);
      setTesting(false);
    }
  };

  const saveServer = async () => {
    const url = await setServerUrl(serverDraft);
    setServer(url);
    setServerDraft(url);
    setError('');
    await testServer(url);
  };

  const resetServer = async () => {
    const url = await setServerUrl('');
    setServer(url);
    setServerDraft(url);
    setServerStatus(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={[s.h1, { marginBottom: 4 }]}>Rupadiya Bus Manager</Text>
        <Text style={[s.muted, { marginBottom: 24 }]}>Sign in with the account your company created for you.</Text>

        <Text style={{ fontWeight: '700', marginBottom: 6, color: colors.text }}>Email</Text>
        <TextInput
          style={[s.input, { marginBottom: 14 }]}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          placeholder="manager@company.in"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!busy}
        />

        <Text style={{ fontWeight: '700', marginBottom: 6, color: colors.text }}>Password</Text>
        <View style={[s.row, { marginBottom: 18 }]}>
          <TextInput
            ref={passwordRef}
            style={[s.input, { flex: 1, paddingRight: 70 }]}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor={colors.muted}
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: 12, padding: 6 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={{ backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[s.btn, !canSubmit && { opacity: 0.5 }]} disabled={!canSubmit} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
        </TouchableOpacity>

        {/* Server address: needed when the phone cannot reach the default API address */}
        <TouchableOpacity onPress={() => setServerOpen((v) => !v)} style={{ marginTop: 22, alignSelf: 'center', padding: 6 }}>
          <Text style={[s.muted, { textAlign: 'center' }]}>Server: {server}</Text>
          <Text style={{ color: colors.blue, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>
            {serverOpen ? 'Hide server settings' : 'Change server'}
          </Text>
        </TouchableOpacity>

        {serverOpen ? (
          <View style={[s.card, { marginTop: 10 }]}>
            <Text style={{ fontWeight: '700', marginBottom: 6, color: colors.text }}>API server address</Text>
            <TextInput
              style={[s.input, { marginBottom: 8, fontSize: 14 }]}
              value={serverDraft}
              onChangeText={setServerDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="192.168.1.12 or https://api.example.com"
              placeholderTextColor={colors.muted}
            />
            <Text style={[s.muted, { marginBottom: 10, fontSize: 12 }]}>
              On the same Wi-Fi, type your computer's IP (port 4500 is added). For the live server use its https address.
            </Text>
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { flex: 1, paddingVertical: 11 }]} onPress={saveServer} disabled={testing}>
                {testing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save & test</Text>}
              </TouchableOpacity>
              <View style={{ width: 10 }} />
              <TouchableOpacity style={[s.btnOutline, { flex: 1 }]} onPress={resetServer} disabled={testing}>
                <Text style={s.btnOutlineText}>Use automatic</Text>
              </TouchableOpacity>
            </View>
            {serverStatus ? (
              <Text style={{ marginTop: 10, fontWeight: '600', color: serverStatus.ok ? colors.primary : colors.danger }}>
                {serverStatus.text}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
