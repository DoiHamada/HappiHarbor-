import { PropsWithChildren } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
};

function initials(name?: string | null): string {
  if (!name) return "HH";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const chars = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return chars || "HH";
}

export function Avatar({ uri, name, size = 44, online = false }: AvatarProps) {
  return (
    <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}> 
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <View style={[styles.avatarFallback, { borderRadius: size / 2 }]}> 
          <Text style={[styles.avatarInitials, { fontSize: Math.max(12, Math.floor(size * 0.34)) }]}>{initials(name)}</Text>
        </View>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

export function SoftChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function SocialCard({ children }: PropsWithChildren) {
  return <View style={styles.socialCard}>{children}</View>;
}

export function CardHeader({
  title,
  avatarUri,
  gender,
  showActiveStatus,
  onPress
}: {
  title: string;
  avatarUri?: string | null;
  gender?: string | null;
  showActiveStatus?: boolean;
  onPress?: () => void;
}) {
  const normalizedGender = (gender ?? "").toLowerCase().replace(/\s+/g, "_");
  const isMale = normalizedGender === "male" || normalizedGender === "man";
  const isFemale = normalizedGender === "female" || normalizedGender === "woman";
  const genderIcon = isMale
    ? { name: "male" as const, color: "#3B82F6" }
    : isFemale
      ? { name: "female" as const, color: "#EC4899" }
      : { name: "male-female" as const, color: "#14B8A6" };

  const body = (
    <View style={styles.cardHeader}>
      <Avatar uri={avatarUri} name={title} size={42} online={Boolean(showActiveStatus)} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={styles.cardHeaderTitle}>{title}</Text>
          <Ionicons name={genderIcon.name} size={16} color={genderIcon.color} />
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    backgroundColor: colors.card
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  avatarInitials: {
    color: colors.primaryDeep,
    fontWeight: "800"
  },
  onlineDot: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: "#fff",
    right: 1,
    bottom: 1
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700"
  },
  socialCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cardHeaderTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "800"
  },
  emptyWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 18,
    alignItems: "center",
    gap: 4
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center"
  }
});
