import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts, Spacing, Typography, FontWeight } from '../../constants/theme';

type Tab = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const TABS: Tab[] = [
  { name: 'index', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  { name: 'sprint', icon: 'flash-outline', activeIcon: 'flash', label: 'Sprint' },
  { name: 'library', icon: 'library-outline', activeIcon: 'library', label: 'Library' },
  { name: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
];

function BlurTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={80}
      tint="dark"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingTop: Spacing[2],
        }}
      >
        {state.routes.map((route, index) => {
          const tab = TABS[index];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: Spacing[2],
                gap: 3,
              }}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                {isFocused && (
                  <View
                    style={{
                      position: 'absolute',
                      backgroundColor: Colors.coral + '20',
                      borderRadius: 14,
                      width: 44,
                      height: 28,
                    }}
                  />
                )}
                <Ionicons
                  name={isFocused ? tab.activeIcon : tab.icon}
                  size={24}
                  color={isFocused ? Colors.coral : Colors.textMuted}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: isFocused ? Colors.coral : Colors.textMuted,
                  fontFamily: isFocused ? Fonts.semibold : Fonts.regular,
                  fontWeight: isFocused ? FontWeight.semibold : FontWeight.normal,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BlurView>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BlurTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="sprint" options={{ title: 'Sprint' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
