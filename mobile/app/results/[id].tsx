import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useQuizSession } from '../../hooks/useQuiz';
import { apiFetch } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';

interface QuestionReview {
  question_id: string;
  question_text: string;
  question_type: string;
  user_answer?: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string | null;
}

function getGradeLabel(score: number): { label: string; emoji: string; color: string } {
  if (score >= 90) return { label: 'Excellent!', emoji: '🏆', color: Colors.gold };
  if (score >= 70) return { label: 'Well Done!', emoji: '🎉', color: Colors.success };
  if (score >= 50) return { label: 'Good Progress', emoji: '📈', color: Colors.indigo };
  return { label: 'Keep Practicing', emoji: '💪', color: Colors.coral };
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'summary' | 'review'>('summary');

  const { session, isLoading: sessionLoading } = useQuizSession(sessionId);

  const { data: questions, isLoading: questionsLoading } = useQuery<QuestionReview[]>({
    queryKey: ['sessionQuestions', sessionId],
    queryFn: () => apiFetch<QuestionReview[]>(`/quiz/sessions/${sessionId}/questions`),
    enabled: !!sessionId,
  });

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', padding: Spacing[8] }}>
        <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>Session not found</Text>
        <Button onPress={() => router.replace('/(tabs)/library')} variant="ghost" style={{ marginTop: Spacing[4] }}>
          Back to Library
        </Button>
      </View>
    );
  }

  const score = session.total_questions > 0
    ? Math.round((session.correct_answers / session.total_questions) * 100)
    : 0;
  const grade = getGradeLabel(score);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + Spacing[4],
          paddingHorizontal: Spacing[5],
          paddingBottom: Spacing[3],
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity onPress={() => router.replace('/(tabs)/library')}>
          <Ionicons name="close" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: Typography.lg, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: 'center' }}>
          Results
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Score Section */}
        <View style={{ alignItems: 'center', paddingVertical: Spacing[6], paddingHorizontal: Spacing[5] }}>
          <Text style={{ fontSize: 48, marginBottom: Spacing[3] }}>{grade.emoji}</Text>
          <ProgressRing
            progress={score}
            size={120}
            strokeWidth={10}
            color={grade.color}
            label={`${score}%`}
          />
          <Text
            style={{
              fontSize: Typography['2xl'],
              fontWeight: FontWeight.bold,
              fontFamily: Fonts.bold,
              color: grade.color,
              marginTop: Spacing[4],
              marginBottom: Spacing[1],
            }}
          >
            {grade.label}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: Typography.base }}>
            {session.correct_answers} / {session.total_questions} correct
          </Text>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: Spacing[5],
            marginBottom: Spacing[5],
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: 4,
          }}
        >
          {(['summary', 'review'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: Spacing[2],
                borderRadius: Radius.lg,
                backgroundColor: activeTab === tab ? Colors.indigo : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: activeTab === tab ? Colors.white : Colors.textMuted,
                  fontWeight: FontWeight.semibold,
                  fontSize: Typography.sm,
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <View style={{ paddingHorizontal: Spacing[5], gap: Spacing[3] }}>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { label: 'Correct', value: String(session.correct_answers), color: Colors.success },
                { label: 'Wrong', value: String(session.total_questions - session.correct_answers), color: Colors.error },
                { label: 'Questions', value: String(session.total_questions), color: Colors.indigo },
              ].map((stat) => (
                <View key={stat.label} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: Typography['2xl'], fontWeight: FontWeight.extrabold, color: stat.color }}>
                    {stat.value}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </Card>

            {session.time_taken_seconds != null && (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
                <Text style={{ fontSize: 24 }}>⏱</Text>
                <View>
                  <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold }}>
                    {Math.floor(session.time_taken_seconds / 60)}m {session.time_taken_seconds % 60}s
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>Time taken</Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <View style={{ paddingHorizontal: Spacing[5], gap: Spacing[3] }}>
            {questionsLoading ? (
              <ActivityIndicator color={Colors.coral} />
            ) : (
              questions?.map((q, i) => (
                <Card key={q.question_id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing[2] }}>
                    <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>
                      Q{i + 1}
                    </Text>
                    <Badge
                      status={q.is_correct ? 'success' : 'failed'}
                      label={q.is_correct ? '✓ Correct' : '✗ Wrong'}
                    />
                  </View>
                  <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.medium, fontSize: Typography.sm, marginBottom: Spacing[3] }}>
                    {q.question_text}
                  </Text>

                  {q.user_answer && (
                    <View style={{ marginBottom: Spacing[2] }}>
                      <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>Your answer:</Text>
                      <Text
                        style={{
                          color: q.is_correct ? Colors.success : Colors.error,
                          fontSize: Typography.sm,
                          fontWeight: FontWeight.medium,
                        }}
                      >
                        {q.user_answer}
                      </Text>
                    </View>
                  )}

                  {!q.is_correct && (
                    <View style={{ backgroundColor: Colors.success + '10', borderRadius: Radius.sm, padding: Spacing[2] }}>
                      <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>Correct answer:</Text>
                      <Text style={{ color: Colors.success, fontSize: Typography.sm, fontWeight: FontWeight.medium }}>
                        {q.correct_answer}
                      </Text>
                    </View>
                  )}

                  {q.explanation && (
                    <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, marginTop: Spacing[2], lineHeight: 16 }}>
                      {q.explanation}
                    </Text>
                  )}
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + Spacing[4],
          paddingTop: Spacing[3],
          backgroundColor: Colors.navy,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          gap: Spacing[2],
        }}
      >
        <Button
          onPress={() => router.replace('/(tabs)/library')}
          variant="ghost"
          size="md"
          fullWidth
          style={{ alignSelf: 'stretch' }}
        >
          Back to Library
        </Button>
      </View>
    </View>
  );
}
