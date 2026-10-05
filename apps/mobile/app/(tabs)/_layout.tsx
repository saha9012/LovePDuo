import React from 'react';
import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/theme/tokens';
import { TabGlyph } from '../../src/components/TabGlyph';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(7,6,10,0.96)',
          borderTopColor: colors.stroke,
          height: 68,
          paddingBottom: 10,
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
      <Tabs.Screen
        name="home"
        options={{
          title: 'Дом',
          tabBarLabel: 'Дом',
          tabBarIcon: ({ focused }) => <TabGlyph name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Игры',
          tabBarLabel: 'Игры',
          tabBarIcon: ({ focused }) => <TabGlyph name="play" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          title: 'Музыка',
          tabBarLabel: 'Музыка',
          tabBarIcon: ({ focused }) => <TabGlyph name="music" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="together"
        options={{
          title: 'Вместе',
          tabBarLabel: 'Вместе',
          tabBarIcon: ({ focused }) => <TabGlyph name="together" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Пара',
          tabBarLabel: 'Пара',
          tabBarIcon: ({ focused }) => <TabGlyph name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
