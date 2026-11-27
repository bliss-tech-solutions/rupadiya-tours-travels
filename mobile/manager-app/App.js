import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, loadServerUrl, setLoggedOutHandler } from './src/api';
import { colors } from './src/theme';
import { TripProvider, useTrip } from './src/TripContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PassengersScreen from './src/screens/PassengersScreen';
import ScanScreen from './src/screens/ScanScreen';
import BusScreen from './src/screens/BusScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TabBar from './src/components/TabBar';
import * as Updates from 'expo-updates';

/**
 * Over-the-air updates: on start, fetch a newer published update and restart into it, so fixes
 * (like a new server address) reach phones without installing a new APK. Gives up after a few
 * seconds on a slow or offline network; then the app runs as is and the update applies next launch.
 */
async function applyLatestUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), 6000);
    if (!check.isAvailable) return;
    const fetched = await withTimeout(Updates.fetchUpdateAsync(), 20000);
    if (fetched.isNew) await Updates.reloadAsync();
  } catch (e) {
    // Offline / slow: keep going; expo-updates also downloads in the background for next launch.
  }
}

/**
 * Rupadiya Bus Samiti — Bus Manager app.
 * Home (date + my bus) · Passengers (by boarding stop) · Scan (centre) · Bus (driver, stops, journey) · Profile.
 */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(null));
    applyLatestUpdate()
      .then(() => loadServerUrl())
      .catch(() => {})
      .then(() => api.resume())
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.header }}>
          <StatusBar style="light" />
          <Ionicons name="bus" size={56} color={colors.headerSub} />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, marginTop: 10 }}>Rupadiya Manager</Text>
          <ActivityIndicator color="#fff" style={{ marginTop: 18 }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {!user ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <LoginScreen onLoggedIn={setUser} />
        </SafeAreaView>
      ) : (
        <TripProvider>
          <Main user={user} onLogout={async () => { await api.logout(); setUser(null); }} />
        </TripProvider>
      )}
    </SafeAreaProvider>
  );
}

function Main({ user, onLogout }) {
  const [tab, setTab] = useState('home');
  const { manifest } = useTrip();
  const dark = tab === 'home' || tab === 'scan' || tab === 'history';
  const pendingPayments = (manifest?.passengers || []).filter((p) => p.bookingStatus !== 'CANCELLED' && p.payment === 'CASH_PENDING').length;

  // Screens stay mounted (keeps the chosen date, filters and scroll position); only the active one is shown.
  const screen = (key, node) => <View key={key} style={{ flex: 1, display: tab === key ? 'flex' : 'none' }}>{node}</View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? colors.header : '#fff' }} edges={['top']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {screen('home', <HomeScreen user={user} onOpenPassengers={() => setTab('passengers')} onOpenBus={() => setTab('bus')} onOpenProfile={() => setTab('profile')} onOpenHistory={() => setTab('history')} />)}
        {screen('passengers', <PassengersScreen onGoHome={() => setTab('home')} />)}
        {screen('scan', <ScanScreen active={tab === 'scan'} onGoHome={() => setTab('home')} />)}
        {screen('bus', <BusScreen onGoHome={() => setTab('home')} />)}
        {screen('history', <HistoryScreen active={tab === 'history'} />)}
        {screen('profile', <ProfileScreen user={user} onLogout={onLogout} onBack={() => setTab('home')} />)}
      </View>
      <TabBar tab={tab} onChange={setTab} badge={{ passengers: pendingPayments }} />
    </SafeAreaView>
  );
}
