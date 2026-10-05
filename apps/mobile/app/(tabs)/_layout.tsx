import React from 'react';
import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(7,6,10,0.96)',
          borderTopColor: colors.stroke,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentAmber,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.uiMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Дом', tabBarLabel: 'Дом' }} />
      <Tabs.Screen name="play" options={{ title: 'Игры', tabBarLabel: 'Игры' }} />
      <Tabs.Screen name="music" options={{ title: 'Музыка', tabBarLabel: 'Музыка' }} />
      <Tabs.Screen name="together" options={{ title: 'Вместе', tabBarLabel: 'Вместе' }} />
      <Tabs.Screen name="profile" options={{ title: 'Пара', tabBarLabel: 'Пара' }} />
    </Tabs>
  );
}
