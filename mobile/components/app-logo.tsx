import { Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { colors } from "@/lib/theme";

const logoXml = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HappiHarbor sailboat center mark"><rect width="512" height="512" fill="none"/><g transform="translate(72,68)"><path d="M176 90C141.2 90 120 117.2 120 152V206C120 236.8 145.2 262 176 262H234V152C234 117.2 210.8 90 176 90Z" fill="#FFB399"/><path d="M246 152C246 117.2 269.2 90 304 90C338.8 90 364 117.2 364 152V206C364 236.8 338.8 262 308 262H246V152Z" fill="#EE9D2B"/><path d="M102 274H380C380 312.7 348.7 344 310 344H172C133.3 344 102 312.7 102 274Z" fill="#B8E3D4"/></g></svg>`;

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center" }}>
      <View
        style={{
          width: compact ? 28 : 34,
          height: compact ? 28 : 34,
          borderRadius: 999,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <SvgXml xml={logoXml} width={compact ? 18 : 22} height={compact ? 18 : 22} />
      </View>
      <View>
        <Text style={{ color: colors.text, fontSize: compact ? 14 : 18, fontWeight: "900" }}>HappiHarbor</Text>
        {!compact ? <Text style={{ color: colors.muted, fontSize: 12 }}>Social Moments</Text> : null}
      </View>
    </View>
  );
}
