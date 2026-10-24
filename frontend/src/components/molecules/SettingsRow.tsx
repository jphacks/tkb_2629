import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type SettingsRowProps = { label: string; value?: string; icon?: string; onPress?: () => void };

export function SettingsRow({ label, value, icon, onPress }: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: '#F0EAF2', borderBottomWidth: 1, flexDirection: 'row', height: 58, paddingHorizontal: 16 },
  icon: { color: colors.navAccent, fontSize: 18, width: 30 },
  label: { color: colors.text, flex: 1, fontSize: 15 },
  value: { color: colors.placeholder, fontSize: 13, marginRight: 10 },
  chevron: { color: colors.placeholder, fontSize: 24 },
});
