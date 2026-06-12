import { Tabs } from 'expo-router';
import { Home, PieChart, TrendingUp, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../../context/LanguageContext';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <>
    <StatusBar style={dark ? 'light' : 'dark'} translucent={true} />
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: dark ? '#030712' : '#f9fafb' },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: dark ? '#6b7280' : '#9ca3af',
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          backgroundColor: dark ? '#111827' : '#ffffff',
          borderTopColor: dark ? '#1f2937' : '#f3f4f6',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          tabBarAccessibilityLabel: t('accessibility.tab_home'),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: t('nav.budget'),
          tabBarIcon: ({ color }) => <PieChart size={22} color={color} />,
          tabBarAccessibilityLabel: t('accessibility.tab_budget'),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: t('nav.trends'),
          tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} />,
          tabBarAccessibilityLabel: t('accessibility.tab_trends'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
          tabBarAccessibilityLabel: t('accessibility.tab_profile'),
        }}
      />
    </Tabs>
    </>
  );
}
