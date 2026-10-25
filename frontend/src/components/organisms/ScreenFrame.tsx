import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../../theme/colors';
import { BottomNavigation } from './BottomNavigation';
import { GlassSurface } from '../atoms/GlassSurface';
import type { ScreenKey } from '../../screens/types';

type ScreenFrameProps = {
  children: ReactNode;
  activeRoute?: ScreenKey;
  headerAction?: ReactNode;
  onNavigate?: (route: ScreenKey) => void;
  title?: string;
  subtitle?: string;
  showNavigation?: boolean;
};

export function ScreenFrame({ children, activeRoute, headerAction, onNavigate, title, subtitle, showNavigation = true }: ScreenFrameProps) {
  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {(title || subtitle) && (
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {headerAction}
          </View>
        )}
        <View style={styles.content}>{children}</View>
        {showNavigation && <BottomNavigation activeRoute={activeRoute} onNavigate={onNavigate} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F4FF', flex: 1 },
  screen: { backgroundColor: '#F7F4FF', flex: 1, position: 'relative' },
  heading: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 56, paddingBottom: 16, paddingHorizontal: 10, paddingTop: 24 },
  headingCopy: { flex: 1 },
  content: { flex: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.placeholder, fontSize: 14, marginTop: 8 },
});
