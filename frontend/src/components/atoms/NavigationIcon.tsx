import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type NavigationIconProps = {
  name: keyof typeof Ionicons.glyphMap;
};

export function NavigationIcon({ name }: NavigationIconProps) {
  return <Ionicons color={colors.navAccent} name={name} size={28} />;
}
