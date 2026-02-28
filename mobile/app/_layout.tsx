import '../global.css';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { analytics } from '../lib/analytics';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    analytics.init();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        analytics.identify(session.user.id, { email: session.user.email });
        const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
        if (hasOnboarded === 'true') {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } else {
        router.replace('/(auth)/login');
      }
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        analytics.identify(session.user.id, { email: session.user.email });
        const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
        if (hasOnboarded === 'true') {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } else if (event === 'SIGNED_OUT') {
        analytics.reset();
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="upload" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="config" options={{ headerShown: false }} />
            <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="results/[id]" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
