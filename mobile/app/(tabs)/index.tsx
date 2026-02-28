import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { useDocuments, type Document } from '../../hooks/useDocuments';
import { useDailySprintStatus, useUserStats } from '../../hooks/useDailySprint';
import { useWeakConcepts } from '../../hooks/useConcepts';
import { useProfile } from '../../hooks/useProfile';

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${greeting}${name ? `, ${name.split(' ')[0]}` : ''} 👋`;
}

function SprintHeroCard({
  sprintStatus,
  isLoading,
}: {
  sprintStatus: ReturnType<typeof useDailySprintStatus>['status'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card noPadding style={{ marginHorizontal: Spacing[5], marginBottom: Spacing[5] }}>
        <Skeleton height={100} style={{ margin: 0, borderRadius: Radius['2xl'] }} />
      </Card>
    );
  }

  const isCompleted = sprintStatus?.status === 'completed';

  return (
    <LinearGradient
      colors={isCompleted ? ['#10B981', '#059669'] : [Colors.indigo, '#8B5CF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: Spacing[5],
        marginBottom: Spacing[5],
        borderRadius: Radius['2xl'],
        padding: Spacing[5],
      }}
    >
      {isCompleted ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
              <Text style={{ fontSize: 24 }}>✅</Text>
              <Text
                style={{
                  fontSize: Typography.lg,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                }}
              >
                Sprint Complete!
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: Typography.sm }}>
              +{sprintStatus?.xp_earned_today ?? 0} XP earned today
            </Text>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: Radius.full,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontSize: Typography.sm }}>
              🔥 {sprintStatus?.streak_count ?? 0}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: Typography.xl,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                marginBottom: 4,
              }}
            >
              Today's Sprint ⚡
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: Typography.sm }}>
              5 questions · ~3 min
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/sprint')}
            style={{
              backgroundColor: Colors.coral,
              borderRadius: Radius.lg,
              paddingHorizontal: Spacing[4],
              paddingVertical: Spacing[2],
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontSize: Typography.sm }}>
              Start →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

function DocumentCard({ doc }: { doc: Document }) {
  const mastery = doc.mastery_percentage ?? 0;
  const displayName = doc.ai_title ?? doc.filename;

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/config', params: { document_id: doc.id } })}
      activeOpacity={0.8}
      style={{
        width: 160,
        marginRight: Spacing[3],
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius['2xl'],
        padding: Spacing[4],
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: Spacing[3] }}>
        <ProgressRing progress={mastery} size={64} strokeWidth={5} />
      </View>
      <Text
        style={{
          color: Colors.textPrimary,
          fontWeight: FontWeight.semibold,
          fontSize: Typography.sm,
          textAlign: 'center',
          marginBottom: Spacing[3],
        }}
        numberOfLines={2}
      >
        {displayName}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: Colors.coral, fontSize: Typography.xs, fontWeight: FontWeight.semibold }}>
          Continue →
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { documents, isLoading: docsLoading } = useDocuments();
  const { status: sprintStatus, isLoading: sprintLoading } = useDailySprintStatus();
  const { concepts, isLoading: conceptsLoading } = useWeakConcepts(3);
  const { profile } = useProfile();
  const { streak, totalXp } = useUserStats();

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const avgMastery =
    readyDocs.length > 0
      ? Math.round(
          readyDocs.reduce((acc, d) => acc + (d.mastery_percentage ?? 0), 0) / readyDocs.length
        )
      : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.coral}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + Spacing[4],
            paddingHorizontal: Spacing[5],
            paddingBottom: Spacing[5],
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: Typography['2xl'],
              fontWeight: FontWeight.bold,
              color: Colors.textPrimary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {getGreeting(profile?.full_name)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
            {/* XP Pill */}
            <View
              style={{
                backgroundColor: Colors.gold + '20',
                borderRadius: Radius.full,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12 }}>⚡</Text>
              <Text
                style={{ color: Colors.gold, fontWeight: FontWeight.bold, fontSize: Typography.xs }}
              >
                {totalXp.toLocaleString()} XP
              </Text>
            </View>
            {/* Streak */}
            <View
              style={{
                backgroundColor: Colors.coral + '20',
                borderRadius: Radius.full,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12 }}>🔥</Text>
              <Text
                style={{ color: Colors.coral, fontWeight: FontWeight.bold, fontSize: Typography.xs }}
              >
                {streak}
              </Text>
            </View>
          </View>
        </View>

        {/* Sprint Hero Card */}
        <SprintHeroCard sprintStatus={sprintStatus} isLoading={sprintLoading} />

        {/* Continue Learning */}
        <View style={{ marginBottom: Spacing[6] }}>
          <Text
            style={{
              fontSize: Typography.lg,
              fontWeight: FontWeight.bold,
              color: Colors.textPrimary,
              paddingHorizontal: Spacing[5],
              marginBottom: Spacing[3],
            }}
          >
            Continue Learning
          </Text>
          {docsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing[5], gap: Spacing[3] }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width={160} height={170} borderRadius={Radius['2xl']} />
              ))}
            </ScrollView>
          ) : readyDocs.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/library')}
              style={{
                marginHorizontal: Spacing[5],
                padding: Spacing[5],
                borderRadius: Radius['2xl'],
                borderWidth: 1,
                borderColor: Colors.border,
                borderStyle: 'dashed',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: Spacing[2] }}>📚</Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, textAlign: 'center' }}>
                No documents yet. Upload your first document to start learning.
              </Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              horizontal
              data={readyDocs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <DocumentCard doc={item} />}
              contentContainerStyle={{ paddingHorizontal: Spacing[5] }}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </View>

        {/* Weak Concepts */}
        {!conceptsLoading && concepts.length > 0 && (
          <View style={{ marginBottom: Spacing[6], paddingHorizontal: Spacing[5] }}>
            <Text
              style={{
                fontSize: Typography.lg,
                fontWeight: FontWeight.bold,
                color: Colors.textPrimary,
                marginBottom: Spacing[3],
              }}
            >
              Needs Practice
            </Text>
            <View style={{ gap: Spacing[3] }}>
              {concepts.map((concept) => (
                <Card key={concept.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: Colors.textPrimary,
                        fontWeight: FontWeight.medium,
                        fontSize: Typography.sm,
                        marginBottom: 6,
                      }}
                    >
                      {concept.name}
                    </Text>
                    <ProgressBar
                      progress={concept.mastery_percentage / 100}
                      color={Colors.coral}
                      height={4}
                    />
                    <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, marginTop: 4 }}>
                      {concept.mastery_percentage}% mastery
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/config',
                        params: { concept_id: concept.id },
                      })
                    }
                    style={{
                      backgroundColor: Colors.coral + '20',
                      borderRadius: Radius.md,
                      paddingHorizontal: Spacing[3],
                      paddingVertical: Spacing[2],
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.coral,
                        fontSize: Typography.xs,
                        fontWeight: FontWeight.semibold,
                      }}
                    >
                      Practice
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Quick Stats */}
        <View
          style={{
            paddingHorizontal: Spacing[5],
            flexDirection: 'row',
            gap: Spacing[3],
            marginBottom: Spacing[6],
          }}
        >
          {[
            { icon: '📄', label: 'Documents', value: String(documents.length) },
            { icon: '🎯', label: 'Avg Mastery', value: `${avgMastery}%` },
            { icon: '🔥', label: 'Streak', value: `${streak}d` },
          ].map((stat) => (
            <Card key={stat.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 24 }}>{stat.icon}</Text>
              <Text
                style={{
                  fontSize: Typography.lg,
                  fontWeight: FontWeight.bold,
                  color: Colors.textPrimary,
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>{stat.label}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
