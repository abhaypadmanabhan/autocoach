import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Colors, Spacing, Typography, FontWeight, Radius } from '../constants/theme';
import { useProfile, useSignOut } from '../hooks/useProfile';
import { ProModal } from '../components/ProModal';

type DailyGoal = 5 | 10 | 20;
type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface Settings {
  dailyGoal: DailyGoal;
  difficulty: Difficulty;
  dailyReminder: boolean;
  achievementAlerts: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 10,
  difficulty: 'Medium',
  dailyReminder: true,
  achievementAlerts: true,
};

const STORAGE_KEY = 'userSettings';

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: Colors.textMuted,
        fontSize: Typography.xs,
        fontWeight: FontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: Spacing[5],
        paddingTop: Spacing[5],
        paddingBottom: Spacing[2],
      }}
    >
      {title}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  right,
  onPress,
  danger,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        paddingHorizontal: Spacing[5],
        gap: Spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? Colors.error : muted ? Colors.textMuted : Colors.textPrimary}
      />
      <Text
        style={{
          flex: 1,
          fontSize: Typography.base,
          color: danger ? Colors.error : muted ? Colors.textMuted : Colors.textPrimary,
        }}
      >
        {label}
      </Text>
      {right ?? (
        onPress ? (
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        ) : null
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={String(opt)}
          onPress={() => onChange(opt)}
          style={{
            flex: 1,
            paddingVertical: Spacing[2],
            alignItems: 'center',
            backgroundColor: value === opt ? Colors.coral : 'transparent',
          }}
          activeOpacity={0.8}
        >
          <Text
            style={{
              fontSize: Typography.sm,
              fontWeight: value === opt ? FontWeight.semibold : FontWeight.normal,
              color: value === opt ? Colors.white : Colors.textMuted,
            }}
          >
            {String(opt)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { signOut, loading: signingOut } = useSignOut();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [proModalVisible, setProModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch {}
      }
    });
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'To delete your account, please contact support@autocoach.app',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + Spacing[3],
          paddingHorizontal: Spacing[5],
          paddingBottom: Spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: Spacing[3] }}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: Typography['2xl'],
            fontWeight: FontWeight.bold,
            color: Colors.textPrimary,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 72, paddingHorizontal: Spacing[5], gap: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.coral,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontSize: Typography.lg }}>
                {(profile?.full_name ?? 'A')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: Typography.base }}>
                {profile?.full_name ?? 'AutoCoach User'}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>{profile?.email ?? ''}</Text>
            </View>
          </View>
          <SettingsRow
            icon="create-outline"
            label="Edit Profile"
            muted
            right={
              <View style={{ backgroundColor: Colors.surface, paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: Radius.sm }}>
                <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>Coming soon</Text>
              </View>
            }
          />
        </View>

        {/* Learning */}
        <SectionHeader title="Learning" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
              <Ionicons name="flag-outline" size={20} color={Colors.textPrimary} />
              <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.base }}>Daily Goal</Text>
            </View>
            <SegmentedControl<DailyGoal>
              options={[5, 10, 20]}
              value={settings.dailyGoal}
              onChange={(v) => updateSetting('dailyGoal', v)}
            />
          </View>
          <View style={{ paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], gap: Spacing[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.textPrimary} />
              <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.base }}>Default Difficulty</Text>
            </View>
            <SegmentedControl<Difficulty>
              options={['Easy', 'Medium', 'Hard']}
              value={settings.difficulty}
              onChange={(v) => updateSetting('difficulty', v)}
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <SettingsRow
            icon="notifications-outline"
            label="Daily Reminder"
            right={
              <Switch
                value={settings.dailyReminder}
                onValueChange={(v) => updateSetting('dailyReminder', v)}
                trackColor={{ false: Colors.border, true: Colors.coral }}
                thumbColor={Colors.white}
              />
            }
          />
          {settings.dailyReminder && (
            <SettingsRow
              icon="time-outline"
              label="Reminder Time"
              right={<Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>8:00 PM</Text>}
            />
          )}
          <SettingsRow
            icon="trophy-outline"
            label="Achievement Alerts"
            right={
              <Switch
                value={settings.achievementAlerts}
                onValueChange={(v) => updateSetting('achievementAlerts', v)}
                trackColor={{ false: Colors.border, true: Colors.coral }}
                thumbColor={Colors.white}
              />
            }
          />
        </View>

        {/* Subscription */}
        <SectionHeader title="Subscription" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 56,
              paddingHorizontal: Spacing[5],
              gap: Spacing[3],
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <Ionicons name="star-outline" size={20} color={Colors.textPrimary} />
            <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.base }}>Current Plan</Text>
            <View style={{ backgroundColor: Colors.surface, paddingHorizontal: Spacing[3], paddingVertical: 4, borderRadius: Radius.full }}>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontWeight: FontWeight.semibold }}>Free</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setProModalVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 56,
              paddingHorizontal: Spacing[5],
              gap: Spacing[3],
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="flash" size={20} color={Colors.coral} />
            <Text style={{ flex: 1, color: Colors.coral, fontWeight: FontWeight.semibold, fontSize: Typography.base }}>
              Upgrade to Pro →
            </Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <SettingsRow
            icon="information-circle-outline"
            label="Version"
            right={<Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>{appVersion}</Text>}
          />
          <SettingsRow
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://autocoach.app/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => Linking.openURL('https://autocoach.app/terms')}
          />
          <SettingsRow
            icon="mail-outline"
            label="Send Feedback"
            onPress={() => Linking.openURL('mailto:support@autocoach.app')}
          />
        </View>

        {/* Danger Zone */}
        <SectionHeader title="Danger Zone" />
        <View style={{ backgroundColor: Colors.card, marginHorizontal: Spacing[4], borderRadius: Radius.lg, overflow: 'hidden' }}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            danger
            onPress={handleSignOut}
          />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={handleDeleteAccount}
          />
        </View>
      </ScrollView>

      <ProModal visible={proModalVisible} onClose={() => setProModalVisible(false)} />
    </View>
  );
}
