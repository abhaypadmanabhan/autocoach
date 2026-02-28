import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useCurrentQuestion, useAnswerQuestion, useQuizSession } from '../../hooks/useQuiz';

// Answer Feedback Overlay
function FeedbackOverlay({
  result,
  onNext,
}: {
  result: {
    is_correct: boolean;
    correct_answer: string;
    explanation?: string | null;
    xp_awarded?: number;
  };
  onNext: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      mass: 0.8,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View
        style={{
          backgroundColor: result.is_correct ? '#0A1F14' : '#1F0A0A',
          borderTopWidth: 1,
          borderTopColor: result.is_correct ? Colors.success + '50' : Colors.error + '50',
          borderTopLeftRadius: Radius['2xl'],
          borderTopRightRadius: Radius['2xl'],
          padding: Spacing[6],
          gap: Spacing[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
          <Text style={{ fontSize: 28 }}>{result.is_correct ? '✅' : '❌'}</Text>
          <Text
            style={{
              fontSize: Typography.xl,
              fontWeight: FontWeight.bold,
              color: result.is_correct ? Colors.success : Colors.error,
              flex: 1,
            }}
          >
            {result.is_correct ? 'Correct!' : 'Incorrect'}
          </Text>
          {result.is_correct && (result.xp_awarded ?? 0) > 0 && (
            <View
              style={{
                backgroundColor: Colors.gold + '20',
                borderRadius: Radius.full,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: Colors.gold, fontWeight: FontWeight.bold, fontSize: Typography.sm }}>
                +{result.xp_awarded} ⚡
              </Text>
            </View>
          )}
        </View>

        {!result.is_correct && result.correct_answer && (
          <View style={{ backgroundColor: Colors.success + '10', borderRadius: Radius.md, padding: Spacing[3] }}>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, marginBottom: 2 }}>
              Correct answer:
            </Text>
            <Text style={{ color: Colors.success, fontWeight: FontWeight.semibold, fontSize: Typography.sm }}>
              {result.correct_answer}
            </Text>
          </View>
        )}

        {result.explanation && (
          <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, lineHeight: 20 }}>
            {result.explanation}
          </Text>
        )}

        <Button onPress={onNext} variant="secondary" size="md" fullWidth style={{ marginTop: Spacing[1] }}>
          Next Question →
        </Button>
      </View>
    </Animated.View>
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  const { session } = useQuizSession(sessionId);
  const { question, isLoading: questionLoading, refetch: refetchQuestion } = useCurrentQuestion(sessionId);
  const { submitAnswer, submitting } = useAnswerQuestion(sessionId);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<{
    is_correct: boolean;
    correct_answer: string;
    explanation?: string | null;
    xp_awarded?: number;
  } | null>(null);

  // Reset answer state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setTextAnswer('');
    setFeedbackResult(null);
  }, [question?.question_id]);

  const handleSubmit = async () => {
    if (!question) return;
    const answer =
      question.question_type === 'free_text' ? textAnswer.trim() : (selectedAnswer ?? '');
    if (!answer) return;

    const response = await submitAnswer({ questionId: question.question_id, answer });
    setFeedbackResult({
      is_correct: response.result.is_correct,
      correct_answer: response.result.correct_answer,
      explanation: response.result.explanation,
      xp_awarded: response.result.xp_awarded,
    });
  };

  const handleNext = async () => {
    if (!session) return;

    // Check if session is complete
    if (session.current_question_number >= session.total_questions) {
      router.replace({
        pathname: '/results/[id]',
        params: { id: sessionId },
      });
      return;
    }

    setFeedbackResult(null);
    await refetchQuestion();
  };

  // Session complete
  if (!questionLoading && question === null) {
    router.replace({ pathname: '/results/[id]', params: { id: sessionId } });
    return null;
  }

  const progress = session
    ? ((session.current_question_number - 1) / session.total_questions)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + Spacing[3],
          paddingHorizontal: Spacing[5],
          paddingBottom: Spacing[3],
          gap: Spacing[2],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textMuted} />
          </TouchableOpacity>
          <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, fontWeight: FontWeight.medium }}>
            {session
              ? `Q${session.current_question_number} of ${session.total_questions}`
              : 'Loading...'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ProgressBar progress={progress} color={Colors.coral} height={4} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >
          {questionLoading ? (
            <View style={{ paddingTop: Spacing[8], alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.coral} />
            </View>
          ) : question ? (
            <>
              {/* Question card */}
              <Card style={{ marginBottom: Spacing[5] }}>
                <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, marginBottom: Spacing[2] }}>
                  {question.question_type === 'mcq'
                    ? 'Multiple Choice'
                    : question.question_type === 'true_false'
                    ? 'True or False'
                    : 'Free Response'}
                </Text>
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontSize: Typography.lg,
                    fontWeight: FontWeight.semibold,
                    lineHeight: 28,
                  }}
                >
                  {question.question_text}
                </Text>
              </Card>

              {/* MCQ Options */}
              {question.question_type === 'mcq' && question.options && (
                <View style={{ gap: Spacing[2] }}>
                  {question.options.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => !feedbackResult && setSelectedAnswer(opt.value)}
                      style={{
                        backgroundColor:
                          selectedAnswer === opt.value ? Colors.indigo + '25' : Colors.card,
                        borderWidth: 1,
                        borderColor:
                          selectedAnswer === opt.value ? Colors.indigo : Colors.border,
                        borderRadius: Radius.xl,
                        padding: Spacing[4],
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing[3],
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor:
                            selectedAnswer === opt.value ? Colors.indigo : Colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color:
                              selectedAnswer === opt.value ? Colors.white : Colors.textMuted,
                            fontWeight: FontWeight.bold,
                            fontSize: Typography.sm,
                          }}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      <Text style={{ color: Colors.textPrimary, flex: 1, fontSize: Typography.base }}>
                        {opt.value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* True/False */}
              {question.question_type === 'true_false' && (
                <View style={{ flexDirection: 'row', gap: Spacing[3] }}>
                  {['True', 'False'].map((val) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => !feedbackResult && setSelectedAnswer(val)}
                      style={{
                        flex: 1,
                        backgroundColor:
                          selectedAnswer === val
                            ? (val === 'True' ? Colors.success + '25' : Colors.error + '25')
                            : Colors.card,
                        borderWidth: 1,
                        borderColor:
                          selectedAnswer === val
                            ? (val === 'True' ? Colors.success : Colors.error)
                            : Colors.border,
                        borderRadius: Radius.xl,
                        paddingVertical: Spacing[5],
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 28, marginBottom: 6 }}>
                        {val === 'True' ? '✓' : '✗'}
                      </Text>
                      <Text
                        style={{
                          color:
                            selectedAnswer === val
                              ? val === 'True'
                                ? Colors.success
                                : Colors.error
                              : Colors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: Typography.lg,
                        }}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Free Text */}
              {question.question_type === 'free_text' && (
                <View>
                  <TextInput
                    value={textAnswer}
                    onChangeText={setTextAnswer}
                    placeholder="Type your answer..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={4}
                    editable={!feedbackResult}
                    style={{
                      backgroundColor: Colors.card,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: Radius.xl,
                      padding: Spacing[4],
                      color: Colors.textPrimary,
                      fontSize: Typography.base,
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                  />
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, marginTop: 4, textAlign: 'right' }}>
                    {textAnswer.length} chars
                  </Text>
                </View>
              )}

              {/* Submit button */}
              {!feedbackResult && (
                <View style={{ marginTop: Spacing[5] }}>
                  <Button
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={
                      question.question_type === 'free_text'
                        ? !textAnswer.trim()
                        : !selectedAnswer
                    }
                    size="lg"
                    fullWidth
                    style={{ alignSelf: 'stretch' }}
                  >
                    Submit Answer
                  </Button>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

        {/* Feedback overlay */}
        {feedbackResult && (
          <FeedbackOverlay result={feedbackResult} onNext={handleNext} />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
