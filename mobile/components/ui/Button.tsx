import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors, Radius, Spacing, Typography, FontWeight } from '../../constants/theme';

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

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: Colors.coral, text: Colors.white },
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

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        {
          backgroundColor: vs.bg,
          borderRadius: Radius.lg,
          paddingVertical: ss.py,
          paddingHorizontal: ss.px,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled || loading ? 0.6 : 1,
          borderWidth: vs.border ? 1 : 0,
          borderColor: vs.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : typeof children === 'string' ? (
        <Text
          style={[
            {
              color: vs.text,
              fontSize: ss.fontSize,
              fontWeight: FontWeight.bold,
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
