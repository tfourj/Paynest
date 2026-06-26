import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Tab } from "../constants";
import { styles } from "../styles";
import type { Colors } from "../theme";

export function Header({ c, title, onAdd }: { c: Colors; title: string; onAdd: () => void }) {
  return (
    <View style={styles.topRow}>
      <View style={styles.titleLockup}>
        <Image source={require("../../assets/paynest.png")} style={styles.headerLogo} />
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      </View>
      <Pressable
        accessibilityLabel="Add subscription"
        onPress={onAdd}
        style={[styles.addCircle, { backgroundColor: c.primary }]}
      >
        <Ionicons name="add" size={25} color="#fff" />
      </Pressable>
    </View>
  );
}

export function ScreenTitle({ c, title }: { c: Colors; title: string }) {
  return (
    <View style={styles.topRow}>
      <View style={styles.titleLockup}>
        <Image source={require("../../assets/paynest.png")} style={styles.headerLogo} />
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      </View>
      <View style={styles.headerActionSpacer} />
    </View>
  );
}

export function EmptyState({ c, onAdd, compact = false }: { c: Colors; onAdd?: () => void; compact?: boolean }) {
  return (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border, marginTop: compact ? 0 : 8 }]}>
      <Ionicons name="card-outline" size={34} color={c.primary} />
      <Text style={[styles.emptyTitle, { color: c.text }]}>No subscriptions yet</Text>
      <Text style={[styles.emptyText, { color: c.textMuted }]}>
        Add your first subscription to track spending and renewals.
      </Text>
      {onAdd && (
        <Pressable onPress={onAdd} style={[styles.emptyButton, { backgroundColor: c.primary }]}>
          <Text style={styles.emptyButtonText}>Add subscription</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SectionHeader({ c, title, action, onPress }: { c: Colors; title: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      <Pressable onPress={onPress}>
        <Text style={[styles.sectionAction, { color: c.primary }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function Chip({
  c,
  label,
  selected = false,
  bordered = false,
  onPress,
}: {
  c: Colors;
  label: string;
  selected?: boolean;
  bordered?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.primarySoft : c.surfaceMuted,
          borderColor: selected ? c.primary : c.border,
          borderWidth: bordered ? 1 : 0,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? c.primary : c.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function Metric({
  c,
  label,
  value,
  style,
}: {
  c: Colors;
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.metric, style, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

export function StatusPill({ c, label }: { c: Colors; label: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: c.primarySoft }]}>
      <Text style={[styles.statusPillText, { color: c.primary }]}>{label}</Text>
    </View>
  );
}

export function TabBar({ c, active, onChange }: { c: Colors; active: Tab; onChange: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const tabs: { label: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: "Dashboard", icon: "home-outline" },
    { label: "Subscriptions", icon: "card-outline" },
    { label: "Insights", icon: "pie-chart-outline" },
    { label: "Settings", icon: "settings-outline" },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {tabs.map((item) => (
        <Pressable
          key={item.label}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() => onChange(item.label)}
          style={styles.tab}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={active === item.label ? c.primary : c.textSoft}
          />
          <Text style={[styles.tabText, { color: active === item.label ? c.primary : c.textSoft }]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
