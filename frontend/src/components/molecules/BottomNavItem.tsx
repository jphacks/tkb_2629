import { Pressable, StyleSheet, Text } from 'react-native';

import { NavigationIcon } from '../atoms/NavigationIcon';
import { colors } from '../../theme/colors';

type BottomNavItemProps = {
  label: string;
  icon: 'home' | 'library' | 'book' | 'search' | 'person';
  active?: boolean;
  onPress?: () => void;
};

export function BottomNavItem({ label, icon, active = false, onPress }: BottomNavItemProps) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.item}>
      <NavigationIcon name={icon} />
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', flex: 1, gap: 4, justifyContent: 'center', paddingTop: 4 ,marginBottom: 24},
  label: { color: colors.navAccent, fontSize: 10, fontWeight: '500' },
  activeLabel: { fontWeight: '800' },
});
