import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { UserRole } from "../../lib/api";
import { AppButton } from "../../ui/controls";
import { theme } from "../../ui/theme";
import { AdminDashboardScreen } from "./admin-dashboard-screen";
import { ChildDashboardScreen } from "./child-dashboard-screen";
import { ParentDashboardScreen } from "./parent-dashboard-screen";

type DashboardShellProps = {
  email: string;
  role: UserRole;
  fullName?: string | null;
  phoneNumber?: string | null;
  nin?: string | null;
  profileImageUrl?: string | null;
  onLogout: () => void;
};

type Tab = "home" | "wallet" | "transactions" | "savings" | "chores" | "allowances" | "actions" | "settings";

const roleLabel: Record<UserRole, string> = {
  parent: "Parent",
  child: "Child",
  admin: "Admin",
};

const tabs: Tab[] = ["home", "wallet", "transactions", "savings", "chores", "allowances", "actions", "settings"];

export function DashboardShell({ email, role, fullName, phoneNumber, nin, profileImageUrl, onLogout }: DashboardShellProps) {
  if (role === "child") {
    return <ChildDashboardScreen email={email} onLogout={onLogout} />;
  }

  if (role === "parent") {
    return <ParentDashboardScreen email={email} fullName={fullName ?? null} phoneNumber={phoneNumber ?? null} nin={nin ?? null} profileImageUrl={profileImageUrl ?? null} onLogout={onLogout} />;
  }

  if (role === "admin") {
    return <AdminDashboardScreen email={email} onLogout={onLogout} />;
  }

  const [tab, setTab] = useState<Tab>("home");

  const heading = useMemo(() => {
    if (tab === "home") return "Dashboard";
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  }, [tab]);

  return (
    <View style={styles.wrap}>
      <View style={styles.sidebar}>
        <Text style={styles.brand}>Kids Banking</Text>
        <Text style={styles.pill}>{roleLabel[role]} Mode</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((item) => {
            const active = item === tab;
            return (
              <Pressable
                key={item}
                onPress={() => setTab(item)}
                style={[styles.tabButton, active ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.mainCard}>
        <Text style={styles.mainTitle}>{heading}</Text>
        <Text style={styles.mainText}>Signed in as: {email}</Text>
        <Text style={styles.mainText}>
          This is the React Native version scaffold (web + mobile) mapped to your current role-based app flow.
        </Text>
        <View style={styles.spacer} />
        <AppButton title="Logout" variant="ghost" onPress={onLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    gap: 12,
  },
  sidebar: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    padding: 14,
    gap: 8,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#ecebff",
    color: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  tabRow: {
    gap: 8,
    paddingVertical: 6,
  },
  tabButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    color: theme.colors.text,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tabButtonTextActive: {
    color: "#fff",
  },
  mainCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    padding: 16,
    gap: 8,
    minHeight: 260,
  },
  mainTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 26,
  },
  mainText: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  spacer: {
    flex: 1,
  },
});

