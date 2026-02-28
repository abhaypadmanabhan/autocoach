import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Radius, Spacing, Typography, FontWeight } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string; gradient?: readonly [string, string] }> = {
  primary: { bg: Colors.coral, text: Colors.white, gradient: ['#F97316', '#C2410C'] },
  secondary: { bg: Colors.indigo, text: Colors.white },
  ghost: { bg: 'transparent', text: Colors.textPrimary, border: Colors.border },
  danger: { bg: Colors.error, text: Colors.white },
};

const sizeStyles: Record<Size, { py: number; px: number; fontSize: number }> = {
  sm: { py: Spacing[2], px: Spacing[3], fontSize: Typography.sm },
  md: { py: Spacing[3], px: Spacing[5], fontSize: Typography.base },
  lg: { py: Spacing[4], px: Spacing[6], fontSize: Typography.base },
};

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  const containerStyle: ViewStyle = {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: disabled || loading ? 0.6 : 1,
    borderWidth: vs.border ? 1 : 0,
    borderColor: vs.border,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    overflow: 'hidden',
  };

  const content = loading ? (
    <ActivityIndicator size="small" color={vs.text} />
  ) : typeof children === 'string' ? (
    <Text
      style={[
        {
          color: vs.text,
          fontSize: ss.fontSize,
          fontWeight: FontWeight.bold,
          fontFamily: Fonts.bold,
        },
        textStyle,
      ]}
    >
      {children}
    </Text>
  ) : (
    children
  );

  if (variant === 'primary' && vs.gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.75}
        style={[containerStyle, style]}
      >
        <LinearGradient
          colors={vs.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: ss.py,
            paddingHorizontal: ss.px,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            width: '100%',
          }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        containerStyle,
        {
          backgroundColor: vs.bg,
          paddingVertical: ss.py,
          paddingHorizontal: ss.px,
        },
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}
