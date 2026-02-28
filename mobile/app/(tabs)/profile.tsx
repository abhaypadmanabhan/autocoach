import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useProfile, useSignOut } from '../../hooks/useProfile';
import { useUserStats } from '../../hooks/useDailySprint';

const XP_PER_LEVEL = 500;

function XPLevelRing({ totalXp }: { totalXp: number }) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const progressInLevel = totalXp % XP_PER_LEVEL;
  const progress = (progressInLevel / XP_PER_LEVEL) * 100;
  const xpToNext = XP_PER_LEVEL - progressInLevel;

  return (
    <View style={{ alignItems: 'center' }}>
      <ProgressRing progress={progress} size={100} strokeWidth={8} color={Colors.gold}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.gold, fontWeight: FontWeight.extrabold, fontFamily: Fonts.extrabold, fontSize: Typography.xl }}>
            {level}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 9, fontFamily: Fonts.regular }}>LEVEL</Text>
        </View>
      </ProgressRing>
      <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular, marginTop: Spacing[1] }}>
        {xpToNext} XP to next level
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isLoading } = useProfile();
  const { streak, totalXp, completedToday } = useUserStats();
  const { signOut, loading: signingOut } = useSignOut();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
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
      ]
    );
  };

  const stats = [
    { icon: '🔥', label: 'Streak', value: `${streak}d` },
    { icon: '📅', label: 'Today', value: completedToday ? 'Done ✓' : 'Pending' },
    { icon: '⚡', label: 'Total XP', value: totalXp.toLocaleString() },
    { icon: '🎯', label: 'Best Streak', value: `${profile?.best_streak ?? 0}d` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing[6],
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + 100,
          gap: Spacing[5],
        }}
      >
        {/* Header */}
        <Text style={{ fontSize: Typography['2xl'], fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary }}>
          Profile
        </Text>

        {/* Avatar + Info */}
        <Card style={{ alignItems: 'center', paddingVertical: Spacing[6] }}>
          {isLoading ? (
            <>
              <Skeleton width={80} height={80} borderRadius={40} style={{ marginBottom: Spacing[3] }} />
              <Skeleton width={120} height={20} style={{ marginBottom: 8 }} />
              <Skeleton width={160} height={14} />
            </>
          ) : (
            <>
              <Avatar name={profile?.full_name} size={80} style={{ marginBottom: Spacing[3] }} />
              <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 }}>
                {profile?.full_name ?? 'AutoCoach User'}
              </Text>
              <Text style={{ fontSize: Typography.sm, fontFamily: Fonts.regular, color: Colors.textMuted }}>
                {profile?.email ?? ''}
              </Text>
            </>
          )}
        </Card>

        {/* XP Level Ring */}
        <Card style={{ alignItems: 'center', paddingVertical: Spacing[5] }}>
          <Text style={{ fontSize: Typography.base, fontWeight: FontWeight.semibold, fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: Spacing[4] }}>
            Learning Level ⚡
          </Text>
          <XPLevelRing totalXp={totalXp} />
        </Card>

        {/* Stats Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] }}>
          {stats.map((stat) => (
            <Card
              key={stat.label}
              style={{
                flex: 1,
                minWidth: '45%',
                alignItems: 'center',
                gap: Spacing[1],
                paddingVertical: Spacing[4],
              }}
            >
              <Text style={{ fontSize: 24 }}>{stat.icon}</Text>
              <Text style={{ fontSize: Typography.lg, fontWeight: FontWeight.bold, fontFamily: Fonts.extrabold, color: Colors.textPrimary }}>
                {stat.value}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        {/* Experience level */}
        {profile?.experience_level && (
          <Card>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, fontFamily: Fonts.regular, marginBottom: Spacing[1] }}>
              Experience Level
            </Text>
            <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontFamily: Fonts.semibold, fontSize: Typography.base, textTransform: 'capitalize' }}>
              {profile.experience_level}
            </Text>
          </Card>
        )}

        {/* Sign out */}
        <Button
          onPress={handleSignOut}
          variant="danger"
          loading={signingOut}
          size="md"
          fullWidth
          style={{ marginTop: Spacing[3], alignSelf: 'stretch' }}
        >
          Sign Out
        </Button>
      </ScrollView>
    </View>
  );
}
