import { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../../theme/colors';
import { BottomNavigation } from './BottomNavigation';
import { GlassSurface } from '../atoms/GlassSurface';
import type { Navigate, ScreenKey } from '../../screens/types';

type ScreenFrameProps = {
  children: ReactNode;
  activeRoute?: ScreenKey;
  onNavigate?: Navigate;
  title?: string;
  subtitle?: string;
  showNavigation?: boolean;
};

export function ScreenFrame({ children, activeRoute, onNavigate, title, subtitle, showNavigation = true }: ScreenFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {(title || subtitle) && (
          <View style={styles.heading}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        {children}
        {showNavigation && <BottomNavigation activeRoute={activeRoute} onNavigate={onNavigate} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F4FF', flex: 1 },
  screen: { backgroundColor: '#F7F4FF', flex: 1 },
  heading: { marginHorizontal: 20, marginTop: 16, paddingBottom: 8, paddingHorizontal: 10, paddingTop: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.placeholder, fontSize: 14, marginTop: 8 },
});
