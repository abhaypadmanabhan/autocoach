import { View, Text, Image, ImageStyle, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, FontWeight, Radius } from '../../constants/theme';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function Avatar({ name, imageUrl, size = 44, style }: AvatarProps) {
  const fontSize = size * 0.38;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 } as ImageStyle}
      />
    );
  }

  return (
    <LinearGradient
      colors={[Colors.indigo, Colors.indigoDark]}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: Colors.white, fontSize, fontWeight: FontWeight.bold }}>
        {getInitials(name)}
      </Text>
    </LinearGradient>
  );
}
