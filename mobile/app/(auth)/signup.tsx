import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';
import { Colors, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const colors = ['transparent', Colors.error, Colors.warning, Colors.gold, Colors.success];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: strength >= i ? colors[strength] : Colors.border,
            }}
          />
        ))}
      </View>
      {password.length > 0 && (
        <Text style={{ color: colors[strength], fontSize: 11, marginTop: 4 }}>
          {labels[strength]}
        </Text>
      )}
    </View>
  );
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (authError) throw authError;
      analytics.capture('sign_up', { method: 'email' });
      setConfirmed(true);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.navy,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing[6],
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: Spacing[4] }}>📬</Text>
        <Text
          style={{
            fontSize: Typography['2xl'],
            fontWeight: FontWeight.bold,
            color: Colors.textPrimary,
            textAlign: 'center',
            marginBottom: Spacing[3],
          }}
        >
          Check your email
        </Text>
        <Text
          style={{
            fontSize: Typography.base,
            color: Colors.textMuted,
            textAlign: 'center',
            marginBottom: Spacing[8],
          }}
        >
          We sent a confirmation link to {email}. Click it to activate your account.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={{
            backgroundColor: Colors.indigo,
            borderRadius: Radius.lg,
            paddingVertical: Spacing[3],
            paddingHorizontal: Spacing[6],
          }}
        >
          <Text
            style={{
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: Typography.base,
            }}
          >
            Back to Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.coral + '30', Colors.navy]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 250 }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + Spacing[8],
            paddingHorizontal: Spacing[6],
            paddingBottom: insets.bottom + Spacing[6],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontSize: Typography['3xl'],
              fontWeight: FontWeight.bold,
              color: Colors.textPrimary,
              marginBottom: Spacing[1],
            }}
          >
            Create account
          </Text>
          <Text
            style={{
              fontSize: Typography.base,
              color: Colors.textMuted,
              marginBottom: Spacing[8],
            }}
          >
            Join AutoCoach and start learning smarter
          </Text>

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
              <Text style={{ color: Colors.error, fontSize: Typography.sm }}>{error}</Text>
            </View>
          )}

          <View style={{ gap: Spacing[4] }}>
            {/* Full Name */}
            <View>
              <Text
                style={{
                  color: Colors.textMuted,
                  fontSize: Typography.sm,
                  marginBottom: Spacing[1],
                  fontWeight: FontWeight.medium,
                }}
              >
                Full Name
              </Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jane Smith"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
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

            {/* Email */}
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

            {/* Password */}
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
              <PasswordStrengthBar password={password} />
            </View>

            <TouchableOpacity
              onPress={handleSignup}
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
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: Spacing[6],
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text
                  style={{
                    color: Colors.indigo,
                    fontSize: Typography.sm,
                    fontWeight: FontWeight.semibold,
                  }}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
