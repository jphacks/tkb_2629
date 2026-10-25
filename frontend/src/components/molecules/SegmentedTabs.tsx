import { Pressable, StyleSheet, Text, View } from 'react-native';

type SegmentedTabOption = {
  label: string;
  value: string;
};

type SegmentedTabsProps = {
  activeColor?: string;
  tintColor?: string;
  onChange: (value: string) => void;
  options: SegmentedTabOption[];
  value: string;
};

export function SegmentedTabs({ activeColor = '#FF7171', onChange, options, tintColor = '#FFF4F4', value }: SegmentedTabsProps) {
  return (
    <View style={[styles.container, { backgroundColor: tintColor }]}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.tab, isSelected && styles.activeTab]}
          >
            <Text style={[styles.label, isSelected && { color: activeColor }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF4F4', borderRadius: 10, flexDirection: 'row', padding: 3 },
  tab: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 },
  activeTab: { backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { height: 1, width: 0 } },
  label: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  activeLabel: { color: '#FF7171' },
});
