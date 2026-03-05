import { Pressable, Text, View } from "react-native";
import { SoftChip } from "@/components/social";
import { colors } from "@/lib/theme";
import { titleize } from "@/types/profile";

export function TagPicker({
  title,
  options,
  selected,
  onToggle
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Pressable key={option} onPress={() => onToggle(option)}>
              <SoftChip label={active ? `Selected: ${titleize(option)}` : titleize(option)} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
