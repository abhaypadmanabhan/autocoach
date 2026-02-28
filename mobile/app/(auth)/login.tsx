import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';
import { Colors, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      analytics.capture('sign_in', { method: 'email' });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.indigo + '40', Colors.navy]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 300,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + Spacing[12],
            paddingHorizontal: Spacing[6],
            paddingBottom: insets.bottom + Spacing[6],
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Tagline */}
          <View style={{ alignItems: 'center', marginBottom: Spacing[12] }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: Radius.xl,
                backgroundColor: Colors.indigo,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing[4],
              }}
            >
              <Text style={{ fontSize: 36 }}>⚡</Text>
            </View>
            <Text
              style={{
                fontSize: Typography['3xl'],
                fontWeight: FontWeight.bold,
                color: Colors.textPrimary,
                marginBottom: Spacing[1],
              }}
            >
              AutoCoach
            </Text>
            <Text
              style={{
                fontSize: Typography.base,
                color: Colors.textMuted,
              }}
            >
              AI-powered learning, anywhere
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View
              style={{
                backgroundColor: Colors.error + '20',
                borderColor: Colors.error,
                borderWidth: 1,
                borderRadius: Radius.md,
                padding: Spacing[3],
                marginBottom: Spacing[4],
              }}
            >
              <Text style={{ color: Colors.error, fontSize: Typography.sm }}>
                {error}
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={{ gap: Spacing[3] }}>
            <View>
              <Text
                style={{
                  color: Colors.textMuted,
                  fontSize: Typography.sm,
                  marginBottom: Spacing[1],
                  fontWeight: FontWeight.medium,
                }}
              >
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={{
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: Radius.lg,
                  paddingHorizontal: Spacing[4],
                  paddingVertical: Spacing[3],
                  color: Colors.textPrimary,
                  fontSize: Typography.base,
                }}
              />
            </View>

            <View>
              <Text
                style={{
                  color: Colors.textMuted,
                  fontSize: Typography.sm,
                  marginBottom: Spacing[1],
                  fontWeight: FontWeight.medium,
                }}
              >
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoComplete="password"
                style={{
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: Radius.lg,
                  paddingHorizontal: Spacing[4],
                  paddingVertical: Spacing[3],
                  color: Colors.textPrimary,
                  fontSize: Typography.base,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: Colors.coral,
                borderRadius: Radius.lg,
                paddingVertical: Spacing[4],
                alignItems: 'center',
                marginTop: Spacing[2],
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text
                  style={{
                    color: Colors.white,
                    fontSize: Typography.base,
                    fontWeight: FontWeight.bold,
                  }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: Spacing[6],
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text
                  style={{
                    color: Colors.indigo,
                    fontSize: Typography.sm,
                    fontWeight: FontWeight.semibold,
                  }}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
