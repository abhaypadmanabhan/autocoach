import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Typography, FontWeight } from '../../constants/theme';

type Status = 'ready' | 'processing' | 'pending' | 'failed' | 'success' | 'warning' | 'info';

const statusConfig: Record<Status, { bg: string; text: string; label: string }> = {
  ready: { bg: Colors.success + '20', text: Colors.success, label: 'Ready' },
  processing: { bg: Colors.warning + '20', text: Colors.warning, label: 'Processing' },
  pending: { bg: Colors.warning + '20', text: Colors.warning, label: 'Pending' },
  failed: { bg: Colors.error + '20', text: Colors.error, label: 'Failed' },
  success: { bg: Colors.success + '20', text: Colors.success, label: 'Success' },
  warning: { bg: Colors.warning + '20', text: Colors.warning, label: 'Warning' },
  info: { bg: Colors.indigo + '20', text: Colors.indigo, label: 'Info' },
};

interface BadgeProps {
  status?: Status;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ status = 'info', label, style }: BadgeProps) {
  const config = statusConfig[status];
  return (
    <View
      style={[
        {
          backgroundColor: config.bg,
          borderRadius: Radius.full,
          paddingHorizontal: 10,
          paddingVertical: 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: config.text,
          fontSize: Typography.xs,
          fontWeight: FontWeight.semibold,
        }}
      >
        {label ?? config.label}
      </Text>
    </View>
  );
}
