import { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  color = Colors.indigo,
  height = 6,
  style,
  animated = true,
}: ProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.min(1, Math.max(0, progress));
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: clamped,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clamped);
    }
  }, [progress]);

  return (
    <View
      style={[
        {
          height,
          backgroundColor: Colors.border,
          borderRadius: Radius.full,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          height,
          borderRadius: Radius.full,
          backgroundColor: color,
          width: widthAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
