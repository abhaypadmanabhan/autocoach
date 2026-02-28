import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Rect, G } from 'react-native-svg';

export type MascotMood = 'happy' | 'thinking' | 'celebrating' | 'idle';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
}

function OwlSvg({ mood, size }: { mood: MascotMood; size: number }) {
  const s = size / 120; // scale factor (designed at 120px)

  const bodyColor = '#FF6B6B';
  const bellyColor = '#FFB3B3';
  const eyeWhite = '#FFFFFF';
  const pupilColor = '#1A1A2E';
  const beakColor = '#F59E0B';
  const wingColor = '#E85555';
  const earColor = '#E85555';

  // Eye expressions per mood
  const getEyes = () => {
    if (mood === 'thinking') {
      // One brow furrowed, looking up-left
      return (
        <G>
          {/* Left eye */}
          <Circle cx={44} cy={54} r={12} fill={eyeWhite} />
          <Circle cx={42} cy={52} r={7} fill={pupilColor} />
          <Circle cx={40} cy={50} r={2} fill={eyeWhite} />
          {/* Right eye */}
          <Circle cx={76} cy={54} r={12} fill={eyeWhite} />
          <Circle cx={74} cy={52} r={7} fill={pupilColor} />
          <Circle cx={72} cy={50} r={2} fill={eyeWhite} />
          {/* Thinking brow */}
          <Path d="M35 44 Q44 40 53 44" stroke={pupilColor} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M67 44 Q76 41 85 44" stroke={pupilColor} strokeWidth={2} fill="none" strokeLinecap="round" />
        </G>
      );
    }
    if (mood === 'celebrating') {
      // Happy arched eyes (crescent)
      return (
        <G>
          {/* Left crescent */}
          <Circle cx={44} cy={54} r={12} fill={eyeWhite} />
          <Path d="M33 54 Q44 45 55 54" fill={bodyColor} />
          {/* Right crescent */}
          <Circle cx={76} cy={54} r={12} fill={eyeWhite} />
          <Path d="M65 54 Q76 45 87 54" fill={bodyColor} />
          {/* Cheek blush */}
          <Ellipse cx={36} cy={64} rx={7} ry={4} fill="#FFB3B3" opacity={0.8} />
          <Ellipse cx={84} cy={64} rx={7} ry={4} fill="#FFB3B3" opacity={0.8} />
        </G>
      );
    }
    if (mood === 'idle') {
      // Half-lidded sleepy
      return (
        <G>
          <Circle cx={44} cy={54} r={12} fill={eyeWhite} />
          <Circle cx={44} cy={56} r={7} fill={pupilColor} />
          <Path d="M32 52 Q44 50 56 52" fill={bodyColor} />
          <Circle cx={76} cy={54} r={12} fill={eyeWhite} />
          <Circle cx={76} cy={56} r={7} fill={pupilColor} />
          <Path d="M64 52 Q76 50 88 52" fill={bodyColor} />
        </G>
      );
    }
    // happy (default)
    return (
      <G>
        <Circle cx={44} cy={54} r={12} fill={eyeWhite} />
        <Circle cx={46} cy={56} r={7} fill={pupilColor} />
        <Circle cx={44} cy={54} r={2} fill={eyeWhite} />
        <Circle cx={76} cy={54} r={12} fill={eyeWhite} />
        <Circle cx={78} cy={56} r={7} fill={pupilColor} />
        <Circle cx={76} cy={54} r={2} fill={eyeWhite} />
        <Ellipse cx={36} cy={64} rx={6} ry={4} fill="#FFB3B3" opacity={0.7} />
        <Ellipse cx={84} cy={64} rx={6} ry={4} fill="#FFB3B3" opacity={0.7} />
      </G>
    );
  };

  const getCap = () => {
    if (mood !== 'thinking') return null;
    return (
      <G>
        {/* Cap brim */}
        <Ellipse cx={60} cy={28} rx={34} ry={7} fill="#1A1A2E" />
        {/* Cap body */}
        <Rect x={30} y={6} width={60} height={24} rx={4} fill="#1A1A2E" />
        {/* Cap tassel */}
        <Rect x={82} y={6} width={3} height={16} fill="#F59E0B" />
        <Circle cx={83.5} cy={22} r={4} fill="#F59E0B" />
      </G>
    );
  };

  const getStars = () => {
    if (mood !== 'celebrating') return null;
    return (
      <G>
        <Polygon points="10,20 12,14 14,20 8,16 16,16" fill="#F59E0B" />
        <Polygon points="105,15 107,9 109,15 103,11 111,11" fill="#F59E0B" />
        <Polygon points="15,90 17,84 19,90 13,86 21,86" fill="#FF6B6B" />
        <Polygon points="100,85 102,79 104,85 98,81 106,81" fill="#6366F1" />
        <Circle cx={20} cy={50} r={3} fill="#F59E0B" />
        <Circle cx={102} cy={55} r={2} fill="#FF6B6B" />
        <Circle cx={8} cy={65} r={2} fill="#6366F1" />
      </G>
    );
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {getStars()}

      {/* Ear tufts */}
      <Path d="M28 42 L22 20 L38 36 Z" fill={earColor} />
      <Path d="M92 42 L98 20 L82 36 Z" fill={earColor} />

      {/* Body */}
      <Ellipse cx={60} cy={78} rx={38} ry={42} fill={bodyColor} />

      {/* Belly */}
      <Ellipse cx={60} cy={82} rx={22} ry={28} fill={bellyColor} />

      {/* Wings */}
      <Path d="M22 70 Q10 85 20 100 Q30 88 38 80 Z" fill={wingColor} />
      <Path d="M98 70 Q110 85 100 100 Q90 88 82 80 Z" fill={wingColor} />

      {/* Head */}
      <Ellipse cx={60} cy={52} rx={32} ry={30} fill={bodyColor} />

      {/* Eyes */}
      {getEyes()}

      {/* Beak */}
      <Polygon points="60,68 53,74 67,74" fill={beakColor} />

      {/* Graduation cap (thinking mood) */}
      {getCap()}

      {/* Feet */}
      <Path d="M46 118 Q42 110 50 108 Q54 118 46 118 Z" fill={beakColor} />
      <Path d="M74 118 Q70 110 78 108 Q82 118 74 118 Z" fill={beakColor} />
    </Svg>
  );
}

export function Mascot({ mood = 'happy', size = 120 }: MascotProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
      <OwlSvg mood={mood} size={size} />
    </Animated.View>
  );
}
