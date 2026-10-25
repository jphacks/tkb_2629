import { StyleSheet } from 'react-native';

import { colors } from '../../theme/colors';
import { BottomNavItem } from '../molecules/BottomNavItem';
import type { Navigate, ScreenKey } from '../../screens/types';
import { GlassSurface } from '../atoms/GlassSurface';

const items = [
  { label: 'ホーム', icon: 'home' as const, route: 'home' as const },
  { label: '本棚', icon: 'library' as const, route: 'bookshelf' as const },
  { label: '今読んでいる本', icon: 'book' as const, route: 'reading' as const },
  { label: '本を探す', icon: 'search' as const, route: 'search' as const },
  { label: 'アカウント', icon: 'person' as const, route: 'account' as const },
];

type BottomNavigationProps = {
  activeRoute?: ScreenKey;
  onNavigate?: Navigate;
};

export function BottomNavigation({ activeRoute, onNavigate }: BottomNavigationProps) {
  return (
    <GlassSurface style={styles.navigation} intensity={32}>
      {items.map((item) => (
        <BottomNavItem
          {...item}
          active={item.route === activeRoute}
          key={item.label}
          onPress={() => onNavigate?.(item.route)}
        />
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  navigation: {
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    height: 100,
    justifyContent: 'space-around',
    shadowColor: colors.black,
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    width: '100%',
    zIndex: 3,
  },

});
