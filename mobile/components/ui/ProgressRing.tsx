import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, FontWeight, Typography } from '../../constants/theme';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
  label?: string;
}

export function ProgressRing({
  progress,
  size = 60,
  strokeWidth = 4,
  color = Colors.indigo,
  backgroundColor = Colors.border,
  children,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      {children ?? (
        <Text
          style={{
            fontSize: size < 50 ? Typography.xs : Typography.sm,
            color: Colors.textPrimary,
            fontWeight: FontWeight.bold,
          }}
        >
          {label ?? `${Math.round(progress)}%`}
        </Text>
      )}
    </View>
  );
}
