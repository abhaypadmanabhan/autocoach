import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mascot, MascotMood } from '../components/Mascot';
import { Colors, Spacing, Typography, FontWeight, Radius } from '../constants/theme';

const { width } = Dimensions.get('window');

interface Slide {
  mood: MascotMood;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    mood: 'happy',
    title: 'Meet your AI tutor',
    subtitle: 'Upload any PDF or deck and AutoCoach turns it into a personalized quiz',
  },
  {
    mood: 'thinking',
    title: 'Learn by doing',
    subtitle: 'Answer questions, get instant feedback, and track your weak spots',
  },
  {
    mood: 'celebrating',
    title: 'Build your streak',
    subtitle: 'Come back daily, earn XP, and watch your mastery grow',
  },
];

async function completeOnboarding() {
  await AsyncStorage.setItem('hasOnboarded', 'true');
  router.replace('/(tabs)');
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const goNext = () => {
    const next = currentIndex + 1;
    if (next >= SLIDES.length) {
      completeOnboarding();
    } else {
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity
          onPress={completeOnboarding}
          style={{
            position: 'absolute',
            top: insets.top + Spacing[3],
            right: Spacing[5],
            zIndex: 10,
            paddingVertical: Spacing[2],
            paddingHorizontal: Spacing[3],
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={index}
            style={{
              width,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: Spacing[8],
              paddingTop: insets.top + 60,
            }}
          >
            {/* Mascot top half */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: Spacing[8] }}>
              <Mascot mood={slide.mood} size={160} />
            </View>

            {/* Text bottom half */}
            <View style={{ flex: 1, alignItems: 'center', gap: Spacing[4], paddingTop: Spacing[6] }}>
              <Text
                style={{
                  fontSize: Typography['3xl'],
                  fontWeight: FontWeight.bold,
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  lineHeight: 38,
                }}
              >
                {slide.title}
              </Text>
              <Text
                style={{
                  fontSize: Typography.base,
                  color: Colors.textMuted,
                  textAlign: 'center',
                  lineHeight: 24,
                }}
              >
                {slide.subtitle}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View
        style={{
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + Spacing[6],
          gap: Spacing[5],
          alignItems: 'center',
        }}
      >
        {/* Pagination dots */}
        <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: Radius.full,
                backgroundColor: i === currentIndex ? Colors.coral : Colors.border,
              }}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity
          onPress={goNext}
          style={{
            width: '100%',
            paddingVertical: Spacing[4],
            borderRadius: Radius.lg,
            backgroundColor: Colors.coral,
            alignItems: 'center',
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              fontSize: Typography.base,
              fontWeight: FontWeight.semibold,
              color: Colors.white,
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
