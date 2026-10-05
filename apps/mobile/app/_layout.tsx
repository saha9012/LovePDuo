import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
} from '@expo-google-fonts/sora';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../src/store/AppStore';
import { MemoriesProvider } from '../src/store/MemoriesStore';
import { RealtimeConnector } from '../src/realtime/RealtimeConnector';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { hydrated, user, pair } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const root = String(segments[0] ?? '');
    const inWelcomeFlow =
      root === '' ||
      root === 'welcome' ||
      root === 'auth' ||
      root === 'pair' ||
      root === 'join' ||
      root === 'index';
    const inTabs = root === '(tabs)';
    const inGame = root === 'game';

    if (!user) {
      if (!inWelcomeFlow || inTabs || inGame) {
        router.replace('/welcome');
      }
      return;
    }

    if (!pair) {
      if (root !== 'pair' && root !== 'auth' && root !== 'join') {
        router.replace('/pair/create');
      }
      return;
    }

    if (!inTabs && !inGame && root !== 'pair' && root !== 'join') {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, user, pair, segments, router]);

  return <>{children}</>;
}

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg0 }} />;
  }

  return (
    <AuthGate>
      <RealtimeConnector />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg0 },
          animation: 'fade',
        }}
      />
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <MemoriesProvider>
          <RootNavigator />
        </MemoriesProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
