import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from './Mascot';
import { Colors, Spacing, Typography, FontWeight, Radius } from '../constants/theme';

interface ProModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ComparisonRow {
  feature: string;
  free: string;
  pro: string;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Documents', free: '3 docs', pro: 'Unlimited' },
  { feature: 'Questions/day', free: '50 Q/day', pro: 'Unlimited' },
  { feature: 'Question types', free: 'MCQ only', pro: 'All types' },
  { feature: 'Analytics', free: 'Basic stats', pro: 'Deep analytics' },
  { feature: 'Streak freeze', free: '—', pro: '✓ Included' },
];

export function ProModal({ visible, onClose }: ProModalProps) {
  const insets = useSafeAreaInsets();

  const handleTrial = () => {
    Alert.alert(
      'Coming Soon!',
      "We're still setting this up. Stay tuned for Pro!",
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <View
          style={{
            backgroundColor: Colors.navy,
            borderTopLeftRadius: Radius['2xl'],
            borderTopRightRadius: Radius['2xl'],
            paddingBottom: insets.bottom + Spacing[6],
            maxHeight: '92%',
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          {/* Handle bar + dismiss */}
          <View style={{ alignItems: 'center', paddingTop: Spacing[3] }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: Radius.full,
                backgroundColor: Colors.border,
              }}
            />
          </View>

          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute',
              top: Spacing[4],
              right: Spacing[5],
              padding: Spacing[1],
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textMuted} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: Spacing[5],
              gap: Spacing[5],
              paddingTop: Spacing[4],
            }}
          >
            {/* Mascot */}
            <View style={{ alignItems: 'center' }}>
              <Mascot mood="celebrating" size={100} />
            </View>

            {/* Title */}
            <View style={{ alignItems: 'center', gap: Spacing[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
                <Ionicons name="flash" size={22} color={Colors.coral} />
                <Text
                  style={{
                    fontSize: Typography['2xl'],
                    fontWeight: FontWeight.bold,
                    color: Colors.textPrimary,
                  }}
                >
                  AutoCoach Pro
                </Text>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.base, textAlign: 'center' }}>
                Unlock your full potential
              </Text>
            </View>

            {/* Comparison table */}
            <View
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: Colors.border,
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: Colors.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <View style={{ flex: 2, padding: Spacing[3] }}>
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, fontWeight: FontWeight.semibold }}>Feature</Text>
                </View>
                <View style={{ flex: 1.5, padding: Spacing[3], alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border }}>
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.sm, fontWeight: FontWeight.semibold }}>FREE</Text>
                </View>
                <View
                  style={{
                    flex: 1.5,
                    padding: Spacing[3],
                    alignItems: 'center',
                    borderLeftWidth: 1,
                    borderLeftColor: Colors.border,
                    backgroundColor: 'rgba(255,107,107,0.08)',
                  }}
                >
                  <Text style={{ color: Colors.coral, fontSize: Typography.sm, fontWeight: FontWeight.bold }}>PRO ✓</Text>
                </View>
              </View>

              {/* Data rows */}
              {COMPARISON.map((row, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: i < COMPARISON.length - 1 ? 1 : 0,
                    borderBottomColor: Colors.border,
                  }}
                >
                  <View style={{ flex: 2, padding: Spacing[3] }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: Typography.sm }}>{row.feature}</Text>
                  </View>
                  <View style={{ flex: 1.5, padding: Spacing[3], alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border }}>
                    <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>{row.free}</Text>
                  </View>
                  <View
                    style={{
                      flex: 1.5,
                      padding: Spacing[3],
                      alignItems: 'center',
                      borderLeftWidth: 1,
                      borderLeftColor: Colors.border,
                      backgroundColor: 'rgba(255,107,107,0.04)',
                    }}
                  >
                    <Text style={{ color: Colors.coral, fontSize: Typography.sm, fontWeight: FontWeight.semibold }}>{row.pro}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* CTAs */}
            <View style={{ gap: Spacing[3] }}>
              <TouchableOpacity
                onPress={handleTrial}
                style={{
                  backgroundColor: Colors.coral,
                  borderRadius: Radius.lg,
                  paddingVertical: Spacing[4],
                  alignItems: 'center',
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontSize: Typography.base }}>
                  Start 7-day Free Trial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={{
                  borderRadius: Radius.lg,
                  paddingVertical: Spacing[3],
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.textMuted, fontSize: Typography.base }}>Continue with Free</Text>
              </TouchableOpacity>
            </View>

            {/* Fine print */}
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, textAlign: 'center' }}>
              Cancel anytime · $9.99/month
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
