import { View, Text, TextInput, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Spacing, Typography, FontWeight } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  return (
    <View style={[{ gap: Spacing[1] }, containerStyle]}>
      {label && (
        <Text
          style={{
            color: Colors.textMuted,
            fontSize: Typography.sm,
            fontWeight: FontWeight.medium,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={Colors.textMuted}
        {...props}
        style={[
          {
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: error ? Colors.error : Colors.border,
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing[4],
            paddingVertical: Spacing[3],
            color: Colors.textPrimary,
            fontSize: Typography.base,
          },
          style,
        ]}
      />
      {error && (
        <Text style={{ color: Colors.error, fontSize: Typography.xs }}>
          {error}
        </Text>
      )}
    </View>
  );
}
