import { View, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  noPadding?: boolean;
  glow?: boolean;
}

export function Card({ children, style, padding = Spacing[4], noPadding = false, glow = false }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.card,
          borderWidth: 1,
          borderColor: glow ? Colors.gold + '40' : Colors.border,
          borderRadius: Radius['2xl'],
          padding: noPadding ? 0 : padding,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
