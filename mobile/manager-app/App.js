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

/**
 * Rupadiya Bus Samiti — Bus Manager app.
 * Home (date + my bus) · Passengers (by boarding stop) · Scan (centre) · Bus (driver, stops, journey) · Profile.
 */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(null));
    loadServerUrl()
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
