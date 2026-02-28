import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  useDailySprintStatus,
  useStartSprint,
  useSubmitSprintAnswer,
  useCompleteSprint,
  type SprintQuestion,
  type SprintAnswerResponse,
} from '../../hooks/useDailySprint';

// ─────────────────────────────────────────────
// Progress Dots
// ─────────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing[5] }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i < current ? Colors.success : i === current ? Colors.coral : Colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// Answer Feedback Overlay
// ─────────────────────────────────────────────
function FeedbackOverlay({
  result,
  onNext,
}: {
  result: SprintAnswerResponse['result'] & { xp_awarded?: number };
  onNext: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
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
          backgroundColor: result.is_correct ? Colors.success + '15' : Colors.error + '15',
          borderTopWidth: 1,
          borderTopColor: result.is_correct ? Colors.success + '40' : Colors.error + '40',
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
              fontFamily: Fonts.bold,
              color: result.is_correct ? Colors.success : Colors.error,
            }}
          >
            {result.is_correct ? 'Correct!' : 'Not quite'}
          </Text>
          {result.is_correct && (result.xp_awarded ?? 0) > 0 && (
            <View
              style={{
                marginLeft: 'auto',
                backgroundColor: Colors.gold + '20',
                borderRadius: Radius.full,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: Colors.gold, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, fontSize: Typography.sm }}>
                +{result.xp_awarded} ⚡
              </Text>
            </View>
          )}
        </View>

        {!result.is_correct && result.correct_answer && (
          <View
            style={{
              backgroundColor: Colors.success + '10',
              borderRadius: Radius.md,
              padding: Spacing[3],
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular, marginBottom: 2 }}>
              Correct answer:
            </Text>
            <Text style={{ color: Colors.success, fontWeight: FontWeight.semibold, fontFamily: Fonts.semibold, fontSize: Typography.sm }}>
              {result.correct_answer}
            </Text>
          </View>
        )}

        {result.explanation && (
          <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, fontFamily: Fonts.regular, lineHeight: 20 }}>
            {result.explanation}
          </Text>
        )}

        <TouchableOpacity
          onPress={onNext}
          style={{
            backgroundColor: Colors.indigo,
            borderRadius: Radius.lg,
            paddingVertical: Spacing[3],
            alignItems: 'center',
            marginTop: Spacing[1],
          }}
        >
          <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, fontSize: Typography.base }}>
            Next Question →
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Question Card
// ─────────────────────────────────────────────
function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
}: {
  question: SprintQuestion;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');

  const handleSubmit = () => {
    const answer =
      question.question_type === 'free_text' ? textAnswer.trim() : (selected ?? '');
    if (!answer) return;
    onAnswer(answer);
  };

  return (
    <View style={{ flex: 1 }}>
      <ProgressDots total={totalQuestions} current={questionIndex} />

      <Card
        style={{
          marginHorizontal: Spacing[5],
          marginBottom: Spacing[4],
        }}
      >
        <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular, marginBottom: Spacing[2] }}>
          Question {questionIndex + 1} of {totalQuestions}
        </Text>
        <Text
          style={{
            color: Colors.textPrimary,
            fontSize: Typography.lg,
            fontWeight: FontWeight.semibold,
            fontFamily: Fonts.semibold,
            lineHeight: 28,
          }}
        >
          {question.question_text}
        </Text>
      </Card>

      {/* MCQ Options */}
      {question.question_type === 'mcq' && question.options && (
        <View style={{ paddingHorizontal: Spacing[5], gap: Spacing[2] }}>
          {question.options.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setSelected(option.value)}
              style={{
                backgroundColor:
                  selected === option.value ? Colors.indigo + '30' : Colors.card,
                borderWidth: 1,
                borderColor:
                  selected === option.value ? Colors.indigo : Colors.border,
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
                    selected === option.value ? Colors.indigo : Colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color:
                      selected === option.value ? Colors.white : Colors.textMuted,
                    fontWeight: FontWeight.bold,
                    fontFamily: Fonts.bold,
                    fontSize: Typography.sm,
                  }}
                >
                  {option.label}
                </Text>
              </View>
              <Text
                style={{
                  color: Colors.textPrimary,
                  fontSize: Typography.base,
                  fontFamily: Fonts.regular,
                  flex: 1,
                }}
              >
                {option.value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* True/False */}
      {question.question_type === 'true_false' && (
        <View style={{ paddingHorizontal: Spacing[5], gap: Spacing[3], flexDirection: 'row' }}>
          {['True', 'False'].map((val) => (
            <TouchableOpacity
              key={val}
              onPress={() => setSelected(val)}
              style={{
                flex: 1,
                backgroundColor:
                  selected === val
                    ? val === 'True'
                      ? Colors.success + '30'
                      : Colors.error + '30'
                    : Colors.card,
                borderWidth: 1,
                borderColor:
                  selected === val
                    ? val === 'True'
                      ? Colors.success
                      : Colors.error
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
                    selected === val
                      ? val === 'True'
                        ? Colors.success
                        : Colors.error
                      : Colors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontFamily: Fonts.bold,
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
        <View style={{ paddingHorizontal: Spacing[5] }}>
          <TextInput
            value={textAnswer}
            onChangeText={setTextAnswer}
            placeholder="Type your answer here..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: Radius.xl,
              padding: Spacing[4],
              color: Colors.textPrimary,
              fontSize: Typography.base,
              fontFamily: Fonts.regular,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular, marginTop: 4, textAlign: 'right' }}>
            {textAnswer.length} chars
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <View style={{ paddingHorizontal: Spacing[5], marginTop: Spacing[5] }}>
        <Button
          onPress={handleSubmit}
          disabled={question.question_type === 'free_text' ? !textAnswer.trim() : !selected}
          fullWidth
          size="lg"
        >
          Submit Answer
        </Button>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Completion Screen
// ─────────────────────────────────────────────
function CompletionView({
  xpEarned,
  newStreak,
  correctCount,
  totalQuestions,
  onDone,
}: {
  xpEarned: number;
  newStreak: number;
  correctCount: number;
  totalQuestions: number;
  onDone: () => void;
}) {
  const score = Math.round((correctCount / totalQuestions) * 100);

  return (
    <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: Spacing[12], paddingHorizontal: Spacing[6] }}>
      <Text style={{ fontSize: 72, marginBottom: Spacing[4] }}>🎉</Text>
      <Text style={{ fontSize: Typography['3xl'], fontWeight: FontWeight.extrabold, fontFamily: Fonts.extrabold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing[2] }}>
        Sprint Complete!
      </Text>
      <Text style={{ fontSize: Typography.base, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing[8] }}>
        {correctCount}/{totalQuestions} correct · {score}% accuracy
      </Text>

      {/* XP Badge */}
      <LinearGradient
        colors={[Colors.gold, '#B45309']}
        style={{ borderRadius: Radius['2xl'], paddingHorizontal: Spacing[8], paddingVertical: Spacing[4], marginBottom: Spacing[5] }}
      >
        <Text style={{ color: Colors.white, fontSize: Typography['2xl'], fontWeight: FontWeight.extrabold, fontFamily: Fonts.extrabold, textAlign: 'center' }}>
          +{xpEarned} XP ⚡
        </Text>
      </LinearGradient>

      {/* Streak badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[8] }}>
        <Text style={{ fontSize: 24 }}>🔥</Text>
        <Text style={{ color: Colors.coral, fontSize: Typography.xl, fontWeight: FontWeight.bold, fontFamily: Fonts.bold }}>
          {newStreak} day streak!
        </Text>
      </View>

      <Button onPress={onDone} variant="secondary" size="lg" fullWidth>
        Done
      </Button>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Main Sprint Screen
// ─────────────────────────────────────────────
export default function SprintScreen() {
  const insets = useSafeAreaInsets();
  const { status, isLoading, refetch } = useDailySprintStatus();
  const { startSprint, starting } = useStartSprint();
  const { submitAnswer, submitting } = useSubmitSprintAnswer();
  const { completeSprint, completing } = useCompleteSprint();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SprintQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<(SprintAnswerResponse['result'] & { xp_awarded?: number }) | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [completionData, setCompletionData] = useState<{ xpEarned: number; newStreak: number } | null>(null);

  // Sync with fetched sprint status if already active
  useEffect(() => {
    if (status?.status === 'active' && status.session_id && !sessionId) {
      setSessionId(status.session_id);
      setQuestions(status.questions ?? []);
    }
  }, [status]);

  const handleStart = async () => {
    const result = await startSprint();
    setSessionId(result.session_id);
    setQuestions(result.questions);
    setCurrentIndex(0);
    setCorrectCount(0);
    setFeedbackResult(null);
  };

  const handleAnswer = async (answer: string) => {
    if (!sessionId || !questions[currentIndex]) return;
    const q = questions[currentIndex];
    const res = await submitAnswer({
      sessionId,
      questionId: q.question_id,
      answer,
    });

    setFeedbackResult({ ...res.result, xp_awarded: res.xp_awarded });
    if (res.result.is_correct) {
      setCorrectCount((c) => c + 1);
    }
  };

  const handleNext = async () => {
    setFeedbackResult(null);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= questions.length) {
      // Complete sprint
      const result = await completeSprint({
        sessionId: sessionId!,
        correctCount,
        totalQuestions: questions.length,
      });
      setCompletionData({ xpEarned: result.xp_awarded, newStreak: result.new_streak });
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleDone = () => {
    // Reset local state and refetch status
    setSessionId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setFeedbackResult(null);
    setCompletionData(null);
    setCorrectCount(0);
    refetch();
  };

  // Show completion
  if (completionData) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.navy, paddingTop: insets.top }}>
        <CompletionView
          xpEarned={completionData.xpEarned}
          newStreak={completionData.newStreak}
          correctCount={correctCount}
          totalQuestions={questions.length}
          onDone={handleDone}
        />
      </View>
    );
  }

  // Active sprint
  if (sessionId && questions.length > 0 && status?.status !== 'completed') {
    const currentQuestion = questions[currentIndex];
    return (
      <View style={{ flex: 1, backgroundColor: Colors.navy }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Sprint header */}
          <View
            style={{
              paddingTop: insets.top + Spacing[3],
              paddingHorizontal: Spacing[5],
              paddingBottom: Spacing[3],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, fontSize: Typography.lg }}>
              Daily Sprint ⚡
            </Text>
            <View style={{ backgroundColor: Colors.gold + '20', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: Colors.gold, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, fontSize: Typography.sm }}>
                {currentIndex + 1}/{questions.length}
              </Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEnabled={!feedbackResult}>
            {currentQuestion && (
              <QuestionCard
                key={`${currentIndex}-${currentQuestion.question_id}`}
                question={currentQuestion}
                questionIndex={currentIndex}
                totalQuestions={questions.length}
                onAnswer={handleAnswer}
              />
            )}

            {(submitting || completing) && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.navy + 'CC' }}>
                <ActivityIndicator size="large" color={Colors.coral} />
              </View>
            )}
          </ScrollView>

          {feedbackResult && (
            <FeedbackOverlay result={feedbackResult} onNext={handleNext} />
          )}
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Ready / Not started
  const isCompleted = status?.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing[6],
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + 100,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: Spacing[4] }}>⚡</Text>
        <Text style={{ fontSize: Typography['3xl'], fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing[2], textAlign: 'center' }}>
          Daily Sprint
        </Text>
        <Text style={{ fontSize: Typography.base, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing[8] }}>
          {isCompleted
            ? "You've completed today's sprint! Come back tomorrow."
            : '5 focused questions to reinforce your learning'}
        </Text>

        {/* Stats card */}
        <Card style={{ width: '100%', marginBottom: Spacing[6] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🔥</Text>
              <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, fontFamily: Fonts.extrabold, color: Colors.coral }}>
                {status?.streak_count ?? 0}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>Streak</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>⚡</Text>
              <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, fontFamily: Fonts.extrabold, color: Colors.gold }}>
                {status?.xp_earned_today ?? 0}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>XP Today</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginBottom: 4 }}>🎯</Text>
              <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, fontFamily: Fonts.extrabold, color: Colors.indigo }}>
                {status?.total_xp ?? 0}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>Total XP</Text>
            </View>
          </View>
        </Card>

        {!isCompleted && (
          <Button
            onPress={handleStart}
            loading={starting || isLoading}
            size="lg"
            fullWidth
            style={{ alignSelf: 'stretch' }}
          >
            Start Sprint →
          </Button>
        )}
      </ScrollView>
    </View>
  );
}
