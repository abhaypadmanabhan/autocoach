import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Typography, FontWeight } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCreateSession } from '../hooks/useQuiz';

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionType = 'mcq' | 'true_false' | 'free_text';

interface WizardConfig {
  focus: 'all' | 'weak';
  numQuestions: number;
  difficulty: Difficulty;
  questionTypes: QuestionType[];
}

const defaultConfig: WizardConfig = {
  focus: 'all',
  numQuestions: 10,
  difficulty: 'medium',
  questionTypes: ['mcq', 'true_false', 'free_text'],
};

// Step indicator
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing[6] }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i <= current ? Colors.coral : Colors.border,
          }}
        />
      ))}
    </View>
  );
}

// Step 1: Focus Area
function FocusStep({
  value,
  onChange,
}: {
  value: WizardConfig['focus'];
  onChange: (v: WizardConfig['focus']) => void;
}) {
  const options: { value: WizardConfig['focus']; label: string; desc: string; icon: string }[] = [
    { value: 'all', label: 'All Topics', desc: 'Cover everything in the document evenly', icon: '📚' },
    { value: 'weak', label: 'Weak Areas', desc: 'Focus on concepts you struggle with', icon: '🎯' },
  ];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing[2] }}>
        What should we focus on?
      </Text>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={{
            backgroundColor: value === opt.value ? Colors.indigo + '20' : Colors.card,
            borderWidth: 1,
            borderColor: value === opt.value ? Colors.indigo : Colors.border,
            borderRadius: Radius['2xl'],
            padding: Spacing[5],
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing[4],
          }}
        >
          <Text style={{ fontSize: 32 }}>{opt.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: Typography.base }}>
              {opt.label}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, marginTop: 2 }}>
              {opt.desc}
            </Text>
          </View>
          {value === opt.value && (
            <Ionicons name="checkmark-circle" size={24} color={Colors.indigo} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Step 2: Question Count
function QuestionCountStep({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options = [5, 10, 15, 20];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing[2] }}>
        How many questions?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] }}>
        {options.map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={{
              flex: 1,
              minWidth: '45%',
              backgroundColor: value === n ? Colors.coral + '20' : Colors.card,
              borderWidth: 1,
              borderColor: value === n ? Colors.coral : Colors.border,
              borderRadius: Radius['2xl'],
              paddingVertical: Spacing[6],
              alignItems: 'center',
              gap: Spacing[1],
            }}
          >
            <Text
              style={{
                fontSize: Typography['3xl'],
                fontWeight: FontWeight.extrabold,
                color: value === n ? Colors.coral : Colors.textPrimary,
              }}
            >
              {n}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>
              ~{n * 0.5} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Step 3: Difficulty
function DifficultyStep({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (v: Difficulty) => void;
}) {
  const options: { value: Difficulty; label: string; desc: string; color: string; icon: string }[] = [
    { value: 'easy', label: 'Easy', desc: 'Recall and recognition', color: Colors.success, icon: '🌱' },
    { value: 'medium', label: 'Medium', desc: 'Understanding and application', color: Colors.gold, icon: '🌿' },
    { value: 'hard', label: 'Hard', desc: 'Analysis and synthesis', color: Colors.coral, icon: '🌳' },
  ];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing[2] }}>
        Choose difficulty
      </Text>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={{
            backgroundColor: value === opt.value ? opt.color + '20' : Colors.card,
            borderWidth: 1,
            borderColor: value === opt.value ? opt.color : Colors.border,
            borderRadius: Radius['2xl'],
            padding: Spacing[5],
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing[4],
          }}
        >
          <Text style={{ fontSize: 28 }}>{opt.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: Typography.base }}>
              {opt.label}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>{opt.desc}</Text>
          </View>
          {value === opt.value && (
            <Ionicons name="checkmark-circle" size={24} color={opt.color} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Step 4: Question Types
function QuestionTypesStep({
  value,
  onChange,
}: {
  value: QuestionType[];
  onChange: (v: QuestionType[]) => void;
}) {
  const options: { value: QuestionType; label: string; icon: string }[] = [
    { value: 'mcq', label: 'Multiple Choice', icon: '🔵' },
    { value: 'true_false', label: 'True / False', icon: '✅' },
    { value: 'free_text', label: 'Free Text', icon: '✍️' },
  ];

  const toggle = (t: QuestionType) => {
    if (value.includes(t)) {
      if (value.length === 1) return; // Must have at least 1
      onChange(value.filter((v) => v !== t));
    } else {
      onChange([...value, t]);
    }
  };

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing[2] }}>
        Question types
      </Text>
      <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, marginBottom: Spacing[2] }}>
        Select all that apply
      </Text>
      {options.map((opt) => {
        const isSelected = value.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => toggle(opt.value)}
            style={{
              backgroundColor: isSelected ? Colors.indigo + '20' : Colors.card,
              borderWidth: 1,
              borderColor: isSelected ? Colors.indigo : Colors.border,
              borderRadius: Radius['2xl'],
              padding: Spacing[4],
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing[3],
            }}
          >
            <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
            <Text
              style={{
                flex: 1,
                color: Colors.textPrimary,
                fontWeight: FontWeight.medium,
                fontSize: Typography.base,
              }}
            >
              {opt.label}
            </Text>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: isSelected ? Colors.indigo : 'transparent',
                borderWidth: isSelected ? 0 : 1.5,
                borderColor: Colors.textMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const STEPS = 4;

export default function ConfigScreen() {
  const insets = useSafeAreaInsets();
  const { document_id, concept_id } = useLocalSearchParams<{
    document_id?: string;
    concept_id?: string;
  }>();

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<WizardConfig>({
    ...defaultConfig,
    focus: concept_id ? 'weak' : 'all',
  });

  const { createSession, creating, error } = useCreateSession();

  const handleNext = () => {
    if (step < STEPS - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  const handleStartQuiz = async () => {
    if (!document_id) return;
    try {
      const session = await createSession({
        document_id,
        num_questions: config.numQuestions,
        difficulty: config.difficulty,
        question_types: config.questionTypes,
        focus: config.focus,
      });
      router.replace({
        pathname: '/session/[id]',
        params: { id: session.session_id },
      });
    } catch (err: any) {
      // Error is surfaced via the error state
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[3], flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={handleBack} style={{ marginRight: Spacing[3] }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: Typography.lg, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary }}>
          Configure Quiz
        </Text>
      </View>

      <StepDots total={STEPS} current={step} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: 140 }}
      >
        {step === 0 && (
          <FocusStep
            value={config.focus}
            onChange={(v) => setConfig({ ...config, focus: v })}
          />
        )}
        {step === 1 && (
          <QuestionCountStep
            value={config.numQuestions}
            onChange={(v) => setConfig({ ...config, numQuestions: v })}
          />
        )}
        {step === 2 && (
          <DifficultyStep
            value={config.difficulty}
            onChange={(v) => setConfig({ ...config, difficulty: v })}
          />
        )}
        {step === 3 && (
          <QuestionTypesStep
            value={config.questionTypes}
            onChange={(v) => setConfig({ ...config, questionTypes: v })}
          />
        )}

        {error && (
          <View style={{ marginTop: Spacing[4], backgroundColor: Colors.error + '20', borderRadius: Radius.md, padding: Spacing[3] }}>
            <Text style={{ color: Colors.error, fontSize: Typography.sm }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + Spacing[4],
          paddingTop: Spacing[4],
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.navy,
          gap: Spacing[2],
        }}
      >
        {step < STEPS - 1 ? (
          <Button onPress={handleNext} size="lg" fullWidth style={{ alignSelf: 'stretch' }}>
            Next →
          </Button>
        ) : (
          <Button
            onPress={handleStartQuiz}
            loading={creating}
            disabled={!document_id}
            size="lg"
            fullWidth
            style={{ alignSelf: 'stretch' }}
          >
            Start Quiz →
          </Button>
        )}
      </View>
    </View>
  );
}
