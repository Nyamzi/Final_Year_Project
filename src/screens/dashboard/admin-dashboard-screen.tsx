import { ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import {
  AdminAnalytics,
  AdminChildUsersData,
  AdminLesson,
  AdminOverviewData,
  AdminParentUsersData,
  AdminQuiz,
  apiAdminAnalytics,
  apiAdminChildUsers,
  apiAdminLessons,
  apiAdminOverview,
  apiAdminParentUsers,
  apiAdminQuizzes,
  apiCreateAdminLesson,
  apiCreateAdminQuiz,
  apiLogDashboardAction,
} from "../../lib/api";
import { AppButton, AppInput } from "../../ui/controls";
import { theme } from "../../ui/theme";

type AdminDashboardScreenProps = {
  email: string;
  onLogout: () => void;
};

type Tab = "home" | "lessons" | "quizzes";

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "home", label: "Overview" },
  { key: "lessons", label: "Lessons" },
  { key: "quizzes", label: "Quizzes" },
];

const sidebarSections = [
  { title: "", items: [{ label: "Overview", icon: "OV", active: true }] },
  {
    title: "USER MANAGEMENT",
    items: [
      { label: "Children", icon: "CA" },
      { label: "Parents", icon: "PG" },
    ],
  },
  {
    title: "SECURITY & MONITORING",
    items: [
      { label: "Fraud Alerts", icon: "FA" },
      { label: "Audit Logs", icon: "AL" },
      { label: "Login Attempts", icon: "LA" },
      { label: "System Performance", icon: "PF" },
    ],
  },
  {
    title: "LEARNING CONTENT",
    items: [{ label: "Learning Content", icon: "LC" }],
  },
];

const categoryColors = ["#5b2ff4", "#2979ff", "#24aa5a", "#ffab14", "#a4a9bc"];
const chartColors = ["#5b2ff4", "#2979ff", "#24aa5a", "#ffab14", "#f43f5e", "#06b6d4"];

const adminSidebarActions: Record<string, { action: string; tab?: Tab }> = {
  Overview: { action: "Open Overview", tab: "home" },
  Children: { action: "Open Children", tab: "home" },
  Parents: { action: "Open Parents", tab: "home" },
  Transactions: { action: "Open Transactions", tab: "home" },
  Approvals: { action: "Open Approvals", tab: "home" },
  Disputes: { action: "Open Disputes", tab: "home" },
  "Fraud Alerts": { action: "Open Fraud Alerts", tab: "home" },
  "Audit Logs": { action: "Open Audit Logs", tab: "home" },
  "Login Attempts": { action: "Open Login Attempts", tab: "home" },
  "System Performance": { action: "Open System Performance", tab: "home" },
  "Learning Content": { action: "Open Learning Content", tab: "lessons" },
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

type ParentRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  childrenCount: number;
  walletManaged: number;
  verificationStatus: "Verified" | "Unverified";
  accountStatus: "Active" | "Suspended" | "Pending";
  dateJoined: string;
  pendingApprovals: number;
  auditActivity: string;
};

type ChildRow = {
  id: string;
  name: string;
  age: number;
  parentName: string;
  photo: string;
  walletBalance: number;
  goals: number;
  learningProgress: number;
  pendingRequests: number;
  accountStatus: "Active" | "Frozen" | "Suspended";
  dateCreated: string;
  totalEarned: number;
  totalSpent: number;
  spendingLimit: number;
  auditActivity: string;
};

function StatusBadge({ label }: { label: string }) {
  const tone =
    label === "Active" || label === "Verified"
      ? styles.statusBadgeGood
      : label === "Pending"
        ? styles.statusBadgeWarn
        : styles.statusBadgeBad;
  return (
    <View style={[styles.statusBadge, tone]}>
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

const adminChartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(91, 47, 244, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(63, 70, 100, ${opacity})`,
  propsForDots: { r: "4", strokeWidth: "2", stroke: "#5b2ff4" },
  propsForBackgroundLines: { stroke: "#edf0f7" },
};

function AdminStatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <View style={styles.adminStatCard}>
      <Text style={styles.adminStatTitle}>{title}</Text>
      <Text style={styles.adminStatValue}>{value}</Text>
      {subtitle ? <Text style={styles.adminStatSub}>{subtitle}</Text> : null}
    </View>
  );
}

function ChartEmptyState({ message = "Not enough data yet." }: { message?: string }) {
  return (
    <View style={styles.chartEmptyState}>
      <Text style={styles.chartEmptyText}>{message}</Text>
    </View>
  );
}

function AdminChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProgressList({ items }: { items: Array<{ label: string; value: number; subLabel?: string }> }) {
  if (items.length === 0) return <ChartEmptyState />;
  return (
    <View style={styles.progressList}>
      {items.map((item) => (
        <View key={`${item.label}-${item.subLabel ?? ""}`} style={styles.progressRow}>
          <View style={styles.progressRowHeader}>
            <Text style={styles.progressLabel}>{item.label}</Text>
            <Text style={styles.progressValue}>{item.value}%</Text>
          </View>
          {item.subLabel ? <Text style={styles.progressSubLabel}>{item.subLabel}</Text> : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, Math.min(100, item.value))}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function AdminAnalyticsCharts({ analytics, width }: { analytics: AdminAnalytics; width: number }) {
  const chartWidth = Math.max(260, Math.min(width, 520));
  const monthly = analytics.monthlyTransactions ?? [];
  const userRoles = analytics.usersByRole ?? [
    { role: "Parents", count: analytics.totalParents },
    { role: "Children", count: analytics.totalChildren },
    { role: "Admins", count: analytics.totalAdmins ?? 0 },
  ];
  const deposits = analytics.depositsVsWithdrawals ?? { deposits: 0, withdrawals: 0, earned: 0 };
  const hasMonthly = monthly.some((item) => item.transactions > 0 || item.deposits > 0 || item.withdrawals > 0);
  const hasUsers = userRoles.some((item) => item.count > 0);
  const hasDeposits = deposits.deposits > 0 || deposits.withdrawals > 0 || deposits.earned > 0;
  const activeDaily = analytics.activeUsers?.daily ?? [];

  return (
    <View style={styles.analyticsGrid}>
      <AdminChartCard title="Total Users by Role">
        {hasUsers ? (
          <PieChart
            data={userRoles.map((item, index) => ({
              name: item.role,
              population: item.count,
              color: chartColors[index % chartColors.length],
              legendFontColor: "#475467",
              legendFontSize: 11,
            }))}
            width={chartWidth}
            height={190}
            chartConfig={adminChartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="8"
            absolute
          />
        ) : <ChartEmptyState />}
      </AdminChartCard>

      <AdminChartCard title="Deposits vs Withdrawals">
        {hasDeposits ? (
          <BarChart
            data={{ labels: ["Deposits", "Withdrawals", "Earned"], datasets: [{ data: [deposits.deposits, deposits.withdrawals, deposits.earned] }] }}
            width={chartWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={adminChartConfig}
            fromZero
            showValuesOnTopOfBars
          />
        ) : <ChartEmptyState />}
      </AdminChartCard>

      <AdminChartCard title="Monthly Transactions">
        {hasMonthly ? (
          <LineChart
            data={{ labels: monthly.map((item) => item.month), datasets: [{ data: monthly.map((item) => item.transactions) }] }}
            width={chartWidth}
            height={220}
            chartConfig={adminChartConfig}
            bezier
            fromZero
          />
        ) : <ChartEmptyState />}
      </AdminChartCard>

      <AdminChartCard title="Active Users">
        {activeDaily.some((item) => item.count > 0) ? (
          <LineChart
            data={{ labels: activeDaily.map((item) => item.day), datasets: [{ data: activeDaily.map((item) => item.count) }] }}
            width={chartWidth}
            height={220}
            chartConfig={adminChartConfig}
            fromZero
          />
        ) : <ChartEmptyState message="No recent dashboard activity yet." />}
        <Text style={styles.chartFootnote}>{formatNumber(analytics.activeUsers?.activeUsersCount ?? 0)} active users in the last 7 days</Text>
      </AdminChartCard>
    </View>
  );
}

function AdminLearningCharts({ analytics, width }: { analytics: AdminAnalytics; width: number }) {
  const chartWidth = Math.max(260, Math.min(width, 520));
  const learning = analytics.learningProgress;
  const quiz = analytics.quizPerformance;
  const quizMonthly = quiz?.monthlyPublished ?? [];

  return (
    <View style={styles.analyticsGrid}>
      <AdminChartCard title="Child Learning Progress">
        {learning && learning.assigned > 0 ? (
          <>
            <View style={styles.learningSummaryRow}>
              <AdminStatCard title="Avg Progress" value={`${learning.averageProgress}%`} />
              <AdminStatCard title="Completed" value={formatNumber(learning.completed)} />
              <AdminStatCard title="In Progress" value={formatNumber(learning.inProgress)} />
            </View>
            <ProgressList items={learning.byChild.map((item) => ({ label: item.childName, subLabel: item.lessonTitle, value: item.progressPercent }))} />
          </>
        ) : <ChartEmptyState message="Assign lessons to children to see progress." />}
      </AdminChartCard>

      <AdminChartCard title="Quiz Performance">
        {quiz && quiz.totalQuizzes > 0 ? (
          <>
            <BarChart
              data={{ labels: ["Published", "Drafts"], datasets: [{ data: [quiz.published, quiz.drafts] }] }}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={adminChartConfig}
              fromZero
              showValuesOnTopOfBars
            />
            <Text style={styles.chartFootnote}>{quiz.completionRate}% of quizzes are published</Text>
          </>
        ) : <ChartEmptyState message="Create quizzes to populate this chart." />}
      </AdminChartCard>

      <AdminChartCard title="Published Quizzes by Month">
        {quizMonthly.some((item) => item.count > 0) ? (
          <LineChart
            data={{ labels: quizMonthly.map((item) => item.month), datasets: [{ data: quizMonthly.map((item) => item.count) }] }}
            width={chartWidth}
            height={200}
            chartConfig={adminChartConfig}
            fromZero
          />
        ) : <ChartEmptyState message="No published quiz trend yet." />}
      </AdminChartCard>
    </View>
  );
}

function AdminSavingsAndPending({ analytics }: { analytics: AdminAnalytics }) {
  const pending = analytics.pendingWithdrawals;
  const goals = analytics.savingsGoalsProgress ?? [];
  return (
    <View style={styles.analyticsGrid}>
      <AdminChartCard title="Pending Withdrawal Requests">
        <View style={styles.learningSummaryRow}>
          <AdminStatCard title="Pending" value={formatNumber(pending?.count ?? analytics.pendingTransactions)} />
          <AdminStatCard title="Amount" value={`UGX ${Math.round(pending?.totalAmount ?? 0).toLocaleString()}`} />
        </View>
        {pending?.items.length ? pending.items.map((item) => (
          <View key={item.id} style={styles.pendingWithdrawalRow}>
            <View>
              <Text style={styles.rowMain}>{item.childName}</Text>
              <Text style={styles.rowMeta}>{item.parentName}</Text>
            </View>
            <Text style={styles.rowMain}>UGX {Math.round(item.amount).toLocaleString()}</Text>
          </View>
        )) : <ChartEmptyState message="No pending withdrawals right now." />}
      </AdminChartCard>

      <AdminChartCard title="Savings Goals Progress">
        <ProgressList items={goals.map((goal) => ({ label: goal.title, subLabel: `${goal.childName} - UGX ${Math.round(goal.currentAmount).toLocaleString()} / ${Math.round(goal.targetAmount).toLocaleString()}`, value: goal.progressPercent }))} />
      </AdminChartCard>
    </View>
  );
}
function SearchFilterBar({
  searchLabel,
  searchValue,
  onSearchChange,
  filters,
}: {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: Array<{ label: string; value: string; options: string[]; onChange: (value: string) => void }>;
}) {
  return (
    <View style={styles.adminFilterWrap}>
      <View style={styles.adminFilterSearch}>
        <AppInput label={searchLabel} value={searchValue} onChangeText={onSearchChange} />
      </View>
      {filters.map((filter) => (
        <View key={filter.label} style={styles.adminFilterGroup}>
          <Text style={styles.adminFilterLabel}>{filter.label}</Text>
          <View style={styles.adminFilterOptions}>
            {filter.options.map((option) => (
              <Pressable
                key={option}
                style={[styles.adminFilterChip, filter.value === option && styles.adminFilterChipActive]}
                onPress={() => filter.onChange(option)}
              >
                <Text style={[styles.adminFilterChipText, filter.value === option && styles.adminFilterChipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function AdminDashboardScreen({ email, onLogout }: AdminDashboardScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const chartWidth = isMobile ? Math.max(260, width - 56) : Math.min(520, Math.max(320, (width - 360) / 2));
  const [tab, setTab] = useState<Tab>("home");
  const [activeSidebarLabel, setActiveSidebarLabel] = useState("Overview");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([]);
  const [parentUsersData, setParentUsersData] = useState<AdminParentUsersData | null>(null);
  const [childUsersData, setChildUsersData] = useState<AdminChildUsersData | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonResourceType, setLessonResourceType] = useState<"text" | "pdf" | "video">("text");
  const [lessonFileName, setLessonFileName] = useState("");
  const [lessonFileData, setLessonFileData] = useState("");
  const [lessonResourceUrl, setLessonResourceUrl] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const safeError = error && /unauthorized/i.test(error) ? "Please log in to continue." : error;
  const [parentSearch, setParentSearch] = useState("");
  const [parentStatusFilter, setParentStatusFilter] = useState("All");
  const [parentVerificationFilter, setParentVerificationFilter] = useState("All");
  const [selectedParent, setSelectedParent] = useState<ParentRow | null>(null);
  const [parentModalAction, setParentModalAction] = useState("View Details");
  const [childSearch, setChildSearch] = useState("");
  const [childStatusFilter, setChildStatusFilter] = useState("All");
  const [childAgeFilter, setChildAgeFilter] = useState("All");
  const [childBalanceFilter, setChildBalanceFilter] = useState("All");
  const [selectedChild, setSelectedChild] = useState<ChildRow | null>(null);
  const [childModalAction, setChildModalAction] = useState("View Profile");

  const overviewCards = useMemo(() => {
    if (!analytics) {
      return [];
    }
    return [
      {
        label: "Total Users",
        icon: "US",
        value: formatNumber(analytics.totalParents + analytics.totalChildren),
        delta: "+12.5% from last month",
        tone: "purple",
      },
      {
        label: "Child Accounts",
        icon: "CA",
        value: formatNumber(analytics.totalChildren),
        delta: "+15.3% from last month",
        tone: "blue",
      },
      {
        label: "Total Transactions",
        icon: "TX",
        value: formatNumber(analytics.totalTransactions),
        delta: "+18.7% from last month",
        tone: "green",
      },
      {
        label: "Total Amount Transacted",
        icon: "UGX",
        value: `UGX ${Math.round(overview?.totalAmountTransacted ?? 0).toLocaleString()}`,
        delta: "+20.1% from last month",
        tone: "orange",
      },
      {
        label: "Pending Approvals",
        icon: "AP",
        value: formatNumber(analytics.pendingTransactions),
        delta: "-8.4% from last month",
        tone: "violet",
        negative: true,
      },
      {
        label: "Active Savings Goals",
        icon: "GO",
        value: formatNumber(analytics.totalLessons + analytics.totalQuizzes),
        delta: "+14.8% from last month",
        tone: "green",
      },
    ];
  }, [analytics, overview]);

  const parentRows = useMemo<ParentRow[]>(() => {
    if (!parentUsersData) return [];
    return parentUsersData.parents.map((parent, index) => ({
      id: parent.id,
      name: parent.fullName,
      email: parent.email,
      phone: `+256 70${String((index * 37 + 112233) % 1000000).padStart(6, "0")}`,
      childrenCount: parent.childCount,
      walletManaged: parent.accountBalance,
      verificationStatus: index % 4 === 0 ? "Unverified" : "Verified",
      accountStatus: index % 7 === 0 ? "Suspended" : index % 5 === 0 ? "Pending" : "Active",
      dateJoined: new Date(Date.now() - index * 86400000 * 9).toISOString(),
      pendingApprovals: index % 3,
      auditActivity: index % 2 === 0 ? "Password reset reviewed" : "Profile details updated",
    }));
  }, [parentUsersData]);

  const childRows = useMemo<ChildRow[]>(() => {
    if (!childUsersData) return [];
    return childUsersData.children.map((child, index) => ({
      id: child.id,
      name: child.nickname,
      age: child.age,
      parentName: child.parentName,
      photo: "👦",
      walletBalance: child.walletBalance,
      goals: index % 4,
      learningProgress: 45 + ((index * 9) % 55),
      pendingRequests: index % 3,
      accountStatus: index % 8 === 0 ? "Frozen" : index % 6 === 0 ? "Suspended" : "Active",
      dateCreated: new Date(Date.now() - index * 86400000 * 6).toISOString(),
      totalEarned: child.totalEarned,
      totalSpent: child.totalSpent,
      spendingLimit: 40000 + index * 5000,
      auditActivity: index % 2 === 0 ? "Wallet review passed" : "Spending alert acknowledged",
    }));
  }, [childUsersData]);

  const filteredParents = useMemo(() => {
    return parentRows.filter((item) => {
      const matchesSearch = [item.name, item.email, item.phone].join(" ").toLowerCase().includes(parentSearch.toLowerCase());
      const matchesStatus = parentStatusFilter === "All" || item.accountStatus === parentStatusFilter;
      const matchesVerification = parentVerificationFilter === "All" || item.verificationStatus === parentVerificationFilter;
      return matchesSearch && matchesStatus && matchesVerification;
    });
  }, [parentRows, parentSearch, parentStatusFilter, parentVerificationFilter]);

  const filteredChildren = useMemo(() => {
    return childRows.filter((item) => {
      const matchesSearch = [item.name, item.parentName].join(" ").toLowerCase().includes(childSearch.toLowerCase());
      const matchesStatus = childStatusFilter === "All" || item.accountStatus === childStatusFilter;
      const matchesAge =
        childAgeFilter === "All" ||
        (childAgeFilter === "5-8" && item.age >= 5 && item.age <= 8) ||
        (childAgeFilter === "9-12" && item.age >= 9 && item.age <= 12) ||
        (childAgeFilter === "13-17" && item.age >= 13 && item.age <= 17);
      const matchesBalance =
        childBalanceFilter === "All" ||
        (childBalanceFilter === "<50k" && item.walletBalance < 50000) ||
        (childBalanceFilter === "50k-200k" && item.walletBalance >= 50000 && item.walletBalance <= 200000) ||
        (childBalanceFilter === ">200k" && item.walletBalance > 200000);
      return matchesSearch && matchesStatus && matchesAge && matchesBalance;
    });
  }, [childRows, childSearch, childStatusFilter, childAgeFilter, childBalanceFilter]);

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const analyticsData = await apiAdminAnalytics();
      const overviewData = await apiAdminOverview();
      const parentUsersStats = await apiAdminParentUsers();
      const childUsersStats = await apiAdminChildUsers();
      const lessonsData = await apiAdminLessons();
      const quizzesData = await apiAdminQuizzes();
      setAnalytics(analyticsData);
      setLessons(lessonsData.lessons);
      setQuizzes(quizzesData.quizzes);
      setOverview(overviewData);
      setParentUsersData(parentUsersStats);
      setChildUsersData(childUsersStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  function clearMessages() {
    setStatus("");
    setError("");
  }

  async function handleCreateLesson() {
    setSubmitting(true);
    clearMessages();
    try {
      await apiCreateAdminLesson({
        title: lessonTitle,
        content: lessonContent,
        resourceType: lessonResourceType,
        resourceUrl: lessonResourceUrl.trim() || undefined,
        fileName: lessonFileName || undefined,
        fileData: lessonFileData || undefined,
        isPublished: false,
      });
      setStatus("Lesson created");
      setLessonTitle("");
      setLessonContent("");
      setLessonResourceType("text");
      setLessonFileData("");
      setLessonFileName("");
      setLessonResourceUrl("");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadForParents() {
    if (!lessonTitle.trim()) {
      setError("Enter a title before uploading.");
      return;
    }
    if (lessonResourceType !== "text" && !lessonFileData && !lessonResourceUrl.trim()) {
      setError("Choose a file or provide a public URL before uploading.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await apiCreateAdminLesson({
        title: lessonTitle,
        content: lessonContent.trim() || "Learning material uploaded by admin.",
        resourceType: lessonResourceType,
        resourceUrl: lessonResourceUrl.trim() || undefined,
        fileName: lessonFileName || undefined,
        fileData: lessonFileData || undefined,
        isPublished: true,
      });
      setStatus("Learning material uploaded and published to parents.");
      setLessonTitle("");
      setLessonContent("");
      setLessonResourceType("text");
      setLessonFileData("");
      setLessonFileName("");
      setLessonResourceUrl("");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload learning material.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickLearningFile() {
    const docRef = globalThis as unknown as { document?: any; FileReader?: any };
    if (!docRef.document || !docRef.FileReader) {
      setError("File upload picker is available on web.");
      return;
    }

    const input = docRef.document.createElement("input");
    input.type = "file";
    input.accept = lessonResourceType === "pdf" ? ".pdf,application/pdf" : "video/mp4,video/webm";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new docRef.FileReader();
      reader.onload = () => {
        setLessonFileData(String(reader.result ?? ""));
        setLessonFileName(file.name);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleCreateQuiz() {
    setSubmitting(true);
    clearMessages();
    try {
      await apiCreateAdminQuiz({ title: quizTitle, isPublished: false });
      setStatus("Quiz created");
      setQuizTitle("");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminAction(action: string, nextTab?: Tab) {
    clearMessages();
    try {
      await apiLogDashboardAction({ dashboard: "admin", action });
      setStatus(`${action} triggered`);
      if (nextTab) {
        setTab(nextTab);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trigger admin action.");
    }
  }

  async function handleSidebarPress(label: string) {
    const config = adminSidebarActions[label];
    setActiveSidebarLabel(label);
    if (config?.tab) {
      setTab(config.tab);
    }
    clearMessages();

    try {
      await apiLogDashboardAction({ dashboard: "admin", action: config?.action ?? `Open ${label}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log admin navigation.");
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.sidebarCard}>
        <View style={styles.sidebarTop}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>KB</Text>
            </View>
            <View>
              <Text style={styles.brand}>Kids Banking</Text>
              <Text style={styles.subBrand}>Admin Panel</Text>
            </View>
          </View>
        </View>
        <View style={styles.menuWrap}>
          {sidebarSections.map((section) => (
            <View key={section.title || "main"} style={styles.menuSection}>
              {section.title ? <Text style={styles.menuSectionTitle}>{section.title}</Text> : null}
              {section.items.map((item) => {
                const isActive = activeSidebarLabel === item.label;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      void handleSidebarPress(item.label);
                    }}
                    style={[styles.menuItem, isActive ? styles.menuItemActive : null]}
                  >
                    <View style={[styles.menuIconPill, isActive ? styles.menuIconPillActive : null]}>
                      <Text style={[styles.menuIcon, isActive ? styles.menuIconActive : null]}>{item.icon}</Text>
                    </View>
                    <Text style={[styles.menuText, isActive ? styles.menuTextActive : null]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Pressable
          style={styles.platformBtn}
          onPress={() => {
            onLogout();
          }}
        >
          <Text style={styles.platformBtnText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.contentCard} contentContainerStyle={styles.contentInner}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Admin Overview</Text>
            <Text style={styles.subtitle}>Monitor platform activity, users, and system performance.</Text>
          </View>
          <View style={styles.topActions} />
        </View>

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
        {safeError ? <Text style={styles.errorText}>{safeError}</Text> : null}
        {loading ? <Text style={styles.infoText}>Loading admin data...</Text> : null}

        {!loading && tab === "home" && analytics && overview ? (
          <>
            {activeSidebarLabel === "Parents" ? (
              <>
                <Text style={styles.title}>Parents Management</Text>
                <Text style={styles.subtitle}>View and manage registered parent/guardian accounts.</Text>
                <View style={styles.adminStatGrid}>
                  <AdminStatCard title="Total Parents" value={formatNumber(parentRows.length)} />
                  <AdminStatCard title="Verified Parents" value={formatNumber(parentRows.filter((p) => p.verificationStatus === "Verified").length)} />
                  <AdminStatCard title="Active Parents" value={formatNumber(parentRows.filter((p) => p.accountStatus === "Active").length)} />
                  <AdminStatCard title="Suspended Parents" value={formatNumber(parentRows.filter((p) => p.accountStatus === "Suspended").length)} />
                  <AdminStatCard title="New Parents This Month" value={formatNumber(parentRows.slice(0, 6).length)} />
                  <AdminStatCard title="Parents With Children" value={formatNumber(parentRows.filter((p) => p.childrenCount > 0).length)} />
                </View>
                <AdminAnalyticsCharts analytics={analytics} width={chartWidth} />
                <AdminSavingsAndPending analytics={analytics} />
                <SearchFilterBar
                  searchLabel="Search by name, email, or phone"
                  searchValue={parentSearch}
                  onSearchChange={setParentSearch}
                  filters={[
                    { label: "Status", value: parentStatusFilter, options: ["All", "Active", "Suspended", "Pending"], onChange: setParentStatusFilter },
                    { label: "Verification", value: parentVerificationFilter, options: ["All", "Verified", "Unverified"], onChange: setParentVerificationFilter },
                  ]}
                />
                <View style={styles.adminTableWrap}>
                  <View style={styles.adminTableHead}>
                    {["Parent Name", "Email", "Phone", "Children", "Wallet Managed", "Verification", "Status", "Date Joined", "Actions"].map((col) => (
                      <Text key={col} style={styles.adminTableHeadText}>{col}</Text>
                    ))}
                  </View>
                  {filteredParents.map((parent) => (
                    <View key={parent.id} style={styles.adminTableRow}>
                      <Text style={styles.adminTableCell}>{parent.name}</Text>
                      <Text style={styles.adminTableCell}>{parent.email}</Text>
                      <Text style={styles.adminTableCell}>{parent.phone}</Text>
                      <Text style={styles.adminTableCell}>{parent.childrenCount}</Text>
                      <Text style={styles.adminTableCell}>UGX {Math.round(parent.walletManaged).toLocaleString()}</Text>
                      <View style={styles.adminTableCell}><StatusBadge label={parent.verificationStatus} /></View>
                      <View style={styles.adminTableCell}><StatusBadge label={parent.accountStatus} /></View>
                      <Text style={styles.adminTableCell}>{new Date(parent.dateJoined).toLocaleDateString()}</Text>
                      <View style={styles.adminTableCell}>
                        <View style={styles.actionGrid}>
                          <Pressable style={styles.actionBtn} onPress={() => { setParentModalAction("View Details"); setSelectedParent(parent); }}><Text style={styles.actionBtnText}>View Details</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setParentModalAction(parent.accountStatus === "Suspended" ? "Activate Account" : "Suspend Account"); setSelectedParent(parent); }}><Text style={styles.actionBtnText}>{parent.accountStatus === "Suspended" ? "Activate" : "Suspend"}</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setParentModalAction("View Children"); setSelectedParent(parent); }}><Text style={styles.actionBtnText}>View Children</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setParentModalAction("View Transactions"); setSelectedParent(parent); }}><Text style={styles.actionBtnText}>View Transactions</Text></Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : activeSidebarLabel === "Children" ? (
              <>
                <Text style={styles.title}>Children Management</Text>
                <Text style={styles.subtitle}>Monitor child accounts, wallet activity, learning progress, and safety controls.</Text>
                <View style={styles.adminStatGrid}>
                  <AdminStatCard title="Total Children" value={formatNumber(childRows.length)} />
                  <AdminStatCard title="Active Child Accounts" value={formatNumber(childRows.filter((c) => c.accountStatus === "Active").length)} />
                  <AdminStatCard title="Frozen Accounts" value={formatNumber(childRows.filter((c) => c.accountStatus === "Frozen").length)} />
                  <AdminStatCard title="Total Child Wallet Balance" value={`UGX ${Math.round(childRows.reduce((s, c) => s + c.walletBalance, 0)).toLocaleString()}`} />
                  <AdminStatCard title="Children With Savings Goals" value={formatNumber(childRows.filter((c) => c.goals > 0).length)} />
                  <AdminStatCard title="Pending Withdrawal Requests" value={formatNumber(childRows.reduce((s, c) => s + c.pendingRequests, 0))} />
                </View>
                <AdminLearningCharts analytics={analytics} width={chartWidth} />
                <AdminSavingsAndPending analytics={analytics} />
                <SearchFilterBar
                  searchLabel="Search by child name or parent name"
                  searchValue={childSearch}
                  onSearchChange={setChildSearch}
                  filters={[
                    { label: "Status", value: childStatusFilter, options: ["All", "Active", "Frozen", "Suspended"], onChange: setChildStatusFilter },
                    { label: "Age Group", value: childAgeFilter, options: ["All", "5-8", "9-12", "13-17"], onChange: setChildAgeFilter },
                    { label: "Balance", value: childBalanceFilter, options: ["All", "<50k", "50k-200k", ">200k"], onChange: setChildBalanceFilter },
                  ]}
                />
                <View style={styles.adminTableWrap}>
                  <View style={styles.adminTableHead}>
                    {["Photo", "Child Name", "Age", "Parent", "Wallet", "Goals", "Learning", "Pending", "Status", "Date Created", "Actions"].map((col) => (
                      <Text key={col} style={styles.adminTableHeadText}>{col}</Text>
                    ))}
                  </View>
                  {filteredChildren.map((child) => (
                    <View key={child.id} style={styles.adminTableRow}>
                      <Text style={styles.adminTableCell}>{child.photo}</Text>
                      <Text style={styles.adminTableCell}>{child.name}</Text>
                      <Text style={styles.adminTableCell}>{child.age}</Text>
                      <Text style={styles.adminTableCell}>{child.parentName}</Text>
                      <Text style={styles.adminTableCell}>UGX {Math.round(child.walletBalance).toLocaleString()}</Text>
                      <Text style={styles.adminTableCell}>{child.goals}</Text>
                      <Text style={styles.adminTableCell}>{child.learningProgress}%</Text>
                      <Text style={styles.adminTableCell}>{child.pendingRequests}</Text>
                      <View style={styles.adminTableCell}><StatusBadge label={child.accountStatus} /></View>
                      <Text style={styles.adminTableCell}>{new Date(child.dateCreated).toLocaleDateString()}</Text>
                      <View style={styles.adminTableCell}>
                        <View style={styles.actionGrid}>
                          <Pressable style={styles.actionBtn} onPress={() => { setChildModalAction("View Profile"); setSelectedChild(child); }}><Text style={styles.actionBtnText}>View Profile</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setChildModalAction("View Parent"); setSelectedChild(child); }}><Text style={styles.actionBtnText}>View Parent</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setChildModalAction("View Transactions"); setSelectedChild(child); }}><Text style={styles.actionBtnText}>View Transactions</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setChildModalAction("View Goals"); setSelectedChild(child); }}><Text style={styles.actionBtnText}>View Goals</Text></Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => { setChildModalAction(child.accountStatus === "Frozen" ? "Unfreeze Account" : "Freeze Account"); setSelectedChild(child); }}><Text style={styles.actionBtnText}>{child.accountStatus === "Frozen" ? "Unfreeze" : "Freeze"}</Text></Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
            <>
            <View style={styles.kpiGrid}>
              {overviewCards.map((card) => {
                const iconBoxStyle =
                  card.tone === "purple" ? styles.kpiIconpurple :
                  card.tone === "blue" ? styles.kpiIconblue :
                  card.tone === "green" ? styles.kpiIcongreen :
                  card.tone === "orange" ? styles.kpiIconorange :
                  styles.kpiIconviolet;
                const iconTextStyle =
                  card.tone === "purple" ? styles.kpiIconTextpurple :
                  card.tone === "blue" ? styles.kpiIconTextblue :
                  card.tone === "green" ? styles.kpiIconTextgreen :
                  card.tone === "orange" ? styles.kpiIconTextorange :
                  styles.kpiIconTextviolet;
                return (
                  <View key={card.label} style={styles.kpiCard}>
                    <View style={[styles.kpiIconBox, iconBoxStyle]}>
                      <Text style={[styles.kpiIconText, iconTextStyle]}>{card.icon}</Text>
                    </View>
                    <View style={styles.kpiCopy}>
                      <Text style={styles.kpiLabel}>{card.label}</Text>
                      <Text style={styles.kpiValue}>{card.value}</Text>
                      <Text style={[styles.kpiDelta, card.negative ? styles.kpiDeltaBad : null]}>{card.delta}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <AdminAnalyticsCharts analytics={analytics} width={chartWidth} />
            <AdminLearningCharts analytics={analytics} width={chartWidth} />
            <AdminSavingsAndPending analytics={analytics} />

            <View style={styles.gridThreeCols}>
              <View style={[styles.softCard, styles.activityCard]}>
                <Text style={styles.cardTitle}>Platform Activity Overview</Text>
                <View style={styles.lineChart}>
                  {overview.activitySeries.map((point, index) => (
                    <View key={`${point}-${index}`} style={styles.linePointWrap}>
                      <View style={[styles.lineBar, { height: ((point || 1) / Math.max(...overview.activitySeries, 1)) * 130 + 10 }]} />
                    </View>
                  ))}
                </View>
                <View style={styles.chartLegendRow}>
                  <Text style={styles.legendItem}>Transactions</Text>
                  <Text style={styles.legendItem}>New Users</Text>
                  <Text style={styles.legendItem}>Approvals</Text>
                </View>
              </View>
              <View style={styles.softCard}>
                <Text style={styles.cardTitle}>Transaction by Category</Text>
                <View style={styles.categoryPanel}>
                  <View style={styles.categoryDonut}>
                    <View style={styles.categoryDonutInner}>
                      <Text style={styles.categoryDonutCurrency}>UGX</Text>
                      <Text style={styles.categoryDonutTotal}>
                        {(overview.totalAmountTransacted / 1_000_000_000).toFixed(2)}B
                      </Text>
                      <Text style={styles.categoryDonutLabel}>Total</Text>
                    </View>
                  </View>
                  <View style={styles.categoryLegend}>
                    {overview.categoryBreakdown.map((item, idx) => (
                      <View key={item.label} style={styles.categoryRow}>
                        <View style={[styles.categoryDot, { backgroundColor: categoryColors[idx % categoryColors.length] }]} />
                        <Text style={styles.categoryName}>{item.label}</Text>
                        <Text style={styles.categoryAmount}>
                          UGX {Math.round(item.amount).toLocaleString()} ({item.percent}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.softCard}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>Critical Alerts</Text>
                  <Text style={styles.cardLink}>View All</Text>
                </View>
                {overview.criticalAlerts.map((alert) => (
                  <View key={alert.id} style={styles.rowItemColumn}>
                    <View style={styles.alertRow}>
                      <View
                        style={[
                          styles.alertIcon,
                          alert.severity === "danger"
                            ? styles.alertIconDanger
                            : alert.severity === "warning"
                              ? styles.alertIconWarning
                              : styles.alertIconInfo,
                        ]}
                      >
                        <Text style={styles.alertIconText}>!</Text>
                      </View>
                      <View style={styles.alertCopy}>
                        <Text style={styles.rowMain}>{alert.title}</Text>
                        <Text style={styles.rowMeta}>{alert.detail}</Text>
                      </View>
                      <Text style={styles.alertTime}>{new Date(alert.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.alertFooterLink}>View All Alerts</Text>
              </View>
            </View>

            <View style={styles.gridFourCols}>
              <View style={styles.softCard}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>Approval Trends</Text>
                  <Text style={styles.cardFilter}>This Month</Text>
                </View>
                <View style={styles.approvalChart}>
                  {overview.approvalSeries.map((point, index) => (
                    <View key={`${point}-${index}`} style={[styles.approvalDot, { left: 14 + index * 16, bottom: point / 2 }]} />
                  ))}
                </View>
                <Text style={styles.bigStat}>
                  {overview.approvalSeries.length > 0 ? `${overview.approvalSeries[overview.approvalSeries.length - 1]}% Approved` : "No data"}
                </Text>
              </View>
              <View style={styles.softCard}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>New Users</Text>
                  <Text style={styles.cardFilter}>This Month</Text>
                </View>
                <Text style={styles.bigValue}>{overview.newUsersThisMonth.toLocaleString()}</Text>
                <Text style={styles.rowMeta}>New users joined</Text>
                <Text style={styles.goodDelta}>+16.4% from last month</Text>
              </View>
              <View style={styles.softCard}>
                <Text style={styles.cardTitle}>Children Accounts</Text>
                <View style={styles.donutMock}>
                  <Text style={styles.donutCenter}>{analytics.totalChildren.toLocaleString()}</Text>
                </View>
                <Text style={styles.rowMeta}>Total child accounts in platform</Text>
              </View>
              <View style={styles.softCard}>
                <Text style={styles.cardTitle}>Quick Actions</Text>
                <View style={styles.actionGrid}>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("View Reports", "lessons")}><Text style={styles.actionBtnText}>View Reports</Text></Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("Manage Alerts", "home")}><Text style={styles.actionBtnText}>Manage Alerts</Text></Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("Broadcast", "home")}><Text style={styles.actionBtnText}>Broadcast</Text></Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("Export Data", "quizzes")}><Text style={styles.actionBtnText}>Export Data</Text></Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("System Settings", "home")}><Text style={styles.actionBtnText}>System Settings</Text></Pressable>
                </View>
              </View>
            </View>
            <View style={styles.gridThreeCols}>
              <View style={[styles.softCard, styles.colSpanTwo]}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>Recent Transactions</Text>
                  <Text style={styles.cardLink}>View All</Text>
                </View>
                <View style={styles.tableHead}>
                  <Text style={styles.tableCell}>ID</Text>
                  <Text style={styles.tableCell}>Child</Text>
                  <Text style={styles.tableCell}>Type</Text>
                  <Text style={styles.tableCell}>Category</Text>
                  <Text style={styles.tableCell}>Amount</Text>
                  <Text style={styles.tableCell}>Status</Text>
                </View>
                {overview.recentTransactions.map((tx) => (
                  <View key={tx.id} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{tx.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.tableCell}>{tx.childName}</Text>
                    <Text style={styles.tableCell}>{tx.type}</Text>
                    <Text style={styles.tableCell}>{tx.category}</Text>
                    <Text style={styles.tableCell}>UGX {Math.round(tx.amount).toLocaleString()}</Text>
                    <Text
                      style={
                        tx.status === "approved"
                          ? styles.tableCellSuccess
                          : tx.status === "pending"
                            ? styles.tableCellPending
                            : styles.tableCellDanger
                      }
                    >
                      {tx.status}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.colStack}>
                <View style={styles.softCard}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>Top Saving Goals</Text>
                    <Text style={styles.cardLink}>View All</Text>
                  </View>
                  {overview.topSavingGoals.map((goal, idx) => (
                    <View key={goal.id} style={styles.simpleListRow}>
                      <Text style={styles.rowMain}>
                        {idx + 1} {goal.title} ({goal.childName})
                      </Text>
                      <Text style={styles.rowMeta}>UGX {Math.round(goal.currentAmount).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.softCard}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>Support Tickets</Text>
                    <Text style={styles.cardLink}>View All</Text>
                  </View>
                  {overview.supportTickets.map((ticket) => (
                    <View key={ticket.id} style={styles.simpleListRow}>
                      <Text style={styles.rowMain}>#{ticket.id.slice(0, 8).toUpperCase()} {ticket.issueType}</Text>
                      <Text
                        style={
                          ticket.status.toLowerCase() === "resolved"
                            ? styles.tableCellSuccess
                            : ticket.status.toLowerCase() === "open"
                              ? styles.tableCellDanger
                              : styles.tableCellPending
                        }
                      >
                        {ticket.status}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>© 2025 Kids Banking. All rights reserved.</Text>
              <View style={styles.footerLinks}>
                <Text style={styles.footerText}>Privacy Policy</Text>
                <Text style={styles.footerDot}>•</Text>
                <Text style={styles.footerText}>Terms of Service</Text>
              </View>
            </View>
            </>
            )}
          </>
        ) : null}

        {!loading && tab === "lessons" ? (
          <View style={styles.sectionWrap}>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Learning Content Library</Text>
              {lessons.map((lesson) => (
                <View key={lesson.id} style={styles.rowItemColumn}>
                  <Text style={styles.rowMain}>{lesson.title}</Text>
                  <Text style={styles.rowMeta}>
                    {lesson.resourceType.toUpperCase()} • {lesson.isPublished ? "Published" : "Draft"}
                  </Text>
                  {lesson.resourceUrl ? (
                    <Text style={styles.rowMeta}>File: {lesson.fileName ?? lesson.resourceUrl}</Text>
                  ) : null}
                </View>
              ))}
              {lessons.length === 0 ? <Text style={styles.infoText}>No lessons yet.</Text> : null}
            </View>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Upload Learning Material</Text>
              <AppInput label="Title" value={lessonTitle} onChangeText={setLessonTitle} />
              <AppInput
                label="Description / Instructions"
                value={lessonContent}
                onChangeText={setLessonContent}
                multiline
                numberOfLines={4}
              />
              <View style={styles.toggleRowGroup}>
                {(["text", "pdf", "video"] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    style={[styles.chipBtn, lessonResourceType === kind && styles.chipBtnActive]}
                    onPress={() => setLessonResourceType(kind)}
                  >
                    <Text style={[styles.chipBtnText, lessonResourceType === kind && styles.chipBtnTextActive]}>
                      {kind.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {lessonResourceType !== "text" ? (
                <>
                  <AppButton title="Choose File From Computer" loading={submitting} onPress={handlePickLearningFile} />
                  <Text style={styles.rowMeta}>{lessonFileName ? `Selected: ${lessonFileName}` : "No file selected yet."}</Text>
                  <AppButton title="Upload For Parents" loading={submitting} onPress={handleUploadForParents} />
                </>
              ) : null}
              <AppInput
                label="Optional Public URL (video or PDF link)"
                value={lessonResourceUrl}
                onChangeText={setLessonResourceUrl}
              />
              {lessonResourceType === "text" ? (
                <AppButton title="Upload For Parents" loading={submitting} onPress={handleUploadForParents} />
              ) : null}
              <AppButton title="Create Lesson" loading={submitting} onPress={handleCreateLesson} />
              <AppButton title="Back to Overview" variant="ghost" onPress={() => { setActiveSidebarLabel("Overview"); setTab("home"); }} />
            </View>
          </View>
        ) : null}

        {!loading && tab === "quizzes" ? (
          <View style={styles.sectionWrap}>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Quizzes</Text>
              {quizzes.map((quiz) => (
                <View key={quiz.id} style={styles.rowItemColumn}>
                  <Text style={styles.rowMain}>{quiz.title}</Text>
                  <Text style={styles.rowMeta}>{quiz.isPublished ? "Published" : "Draft"}</Text>
                </View>
              ))}
              {quizzes.length === 0 ? <Text style={styles.infoText}>No quizzes yet.</Text> : null}
            </View>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Create Quiz</Text>
              <AppInput label="Title" value={quizTitle} onChangeText={setQuizTitle} />
              <AppButton title="Create Quiz" loading={submitting} onPress={handleCreateQuiz} />
              <AppButton title="Back to Overview" variant="ghost" onPress={() => { setActiveSidebarLabel("Overview"); setTab("home"); }} />
            </View>
          </View>
        ) : null}

      </ScrollView>

      {selectedParent ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedParent(null)} />
          <View style={styles.modalCard}>
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>Parent: {parentModalAction}</Text>
              <Pressable onPress={() => setSelectedParent(null)}><Text style={styles.cardLink}>Close</Text></Pressable>
            </View>
            <Text style={styles.rowMain}>{selectedParent.name}</Text>
            <Text style={styles.rowMeta}>{selectedParent.email} • {selectedParent.phone}</Text>
            <Text style={styles.rowMeta}>Children linked: {selectedParent.childrenCount}</Text>
            <Text style={styles.rowMeta}>Total wallet balance managed: UGX {Math.round(selectedParent.walletManaged).toLocaleString()}</Text>
            <Text style={styles.rowMeta}>Recent transactions: 8 in last 7 days (mock)</Text>
            <Text style={styles.rowMeta}>Pending approvals: {selectedParent.pendingApprovals}</Text>
            <Text style={styles.rowMeta}>Audit activity: {selectedParent.auditActivity}</Text>
            <Text style={styles.rowMeta}>Account status controls: {selectedParent.accountStatus}</Text>
          </View>
        </View>
      ) : null}

      {selectedChild ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedChild(null)} />
          <View style={styles.modalCard}>
            <View style={styles.cardHeadRow}>
              <Text style={styles.cardTitle}>Child: {childModalAction}</Text>
              <Pressable onPress={() => setSelectedChild(null)}><Text style={styles.cardLink}>Close</Text></Pressable>
            </View>
            <Text style={styles.rowMain}>{selectedChild.name} • Age {selectedChild.age}</Text>
            <Text style={styles.rowMeta}>Parent linked: {selectedChild.parentName}</Text>
            <Text style={styles.rowMeta}>Wallet balance: UGX {Math.round(selectedChild.walletBalance).toLocaleString()}</Text>
            <Text style={styles.rowMeta}>Savings goals: {selectedChild.goals}</Text>
            <Text style={styles.rowMeta}>Recent transactions: 6 in last 7 days (mock)</Text>
            <Text style={styles.rowMeta}>Chores/rewards activity: Updated today (mock)</Text>
            <Text style={styles.rowMeta}>Learning progress: {selectedChild.learningProgress}%</Text>
            <Text style={styles.rowMeta}>Spending limits: UGX {Math.round(selectedChild.spendingLimit).toLocaleString()}</Text>
            <Text style={styles.rowMeta}>Audit activity: {selectedChild.auditActivity}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 1800,
    alignSelf: "center",
    flexDirection: "row",
    flex: 1,
    backgroundColor: "#f6f7fd",
  },
  sidebarCard: {
    width: 250,
    backgroundColor: "#111b4f",
    padding: 16,
    gap: 14,
    shadowColor: "#0e1646",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 8, height: 0 },
  },
  sidebarTop: {
    borderBottomWidth: 1,
    borderBottomColor: "#283072",
    paddingBottom: 10,
    gap: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#4c42d8",
    fontSize: 12,
    fontWeight: "900",
  },
  brand: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  subBrand: {
    color: "#c8cbf7",
    fontSize: 12,
    fontWeight: "600",
  },
  menuWrap: {
    gap: 10,
    flex: 1,
  },
  menuSection: {
    gap: 5,
  },
  menuSectionTitle: {
    color: "#aab4e8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0,
    marginTop: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  menuItemActive: {
    backgroundColor: "#4935c8",
  },
  menuIconPill: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#29306c",
  },
  menuIconPillActive: {
    backgroundColor: "#4e59ef",
  },
  menuIcon: {
    fontSize: 9,
    fontWeight: "700",
    color: "#aeb5f2",
  },
  menuIconActive: {
    color: "#ffffff",
  },
  menuText: {
    color: "#dee2ff",
    fontWeight: "600",
    fontSize: 12,
  },
  menuTextActive: {
    color: "#fff",
  },
  platformBtn: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#3c468e",
    backgroundColor: "#171d54",
    paddingVertical: 10,
    alignItems: "center",
  },
  platformBtnText: {
    color: "#dce2ff",
    fontWeight: "700",
    fontSize: 12,
  },
  contentCard: {
    flex: 1,
    backgroundColor: "#f6f7fd",
    paddingHorizontal: 26,
  },
  contentInner: {
    gap: 16,
    paddingVertical: 24,
    paddingBottom: 30,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.muted,
    maxWidth: 580,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#d8ddf1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlBtnIcon: {
    color: "#283153",
    fontSize: 10,
    fontWeight: "900",
  },
  controlBtnText: {
    color: "#4d5871",
    fontSize: 12,
    fontWeight: "600",
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#d8ddf1",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff4a57",
    position: "absolute",
    top: 8,
    right: 8,
  },
  bellText: {
    color: "#65708a",
    fontSize: 10,
    fontWeight: "700",
  },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8ddf1",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  userMenuWrap: {
    position: "relative",
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eaedf8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#43506d",
    fontWeight: "700",
    fontSize: 10,
  },
  userName: {
    color: "#1d2538",
    fontWeight: "700",
    fontSize: 12,
  },
  userRole: {
    color: "#7180a3",
    fontSize: 10,
  },
  userCaret: {
    color: "#607090",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
  },
  accountDropdown: {
    position: "absolute",
    top: 42,
    right: 0,
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8ddf1",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    zIndex: 50,
  },
  accountDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountDropdownText: {
    color: "#33425f",
    fontWeight: "700",
    fontSize: 12,
  },
  statusText: {
    color: theme.colors.success,
    fontWeight: "700",
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: "700",
  },
  infoText: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  sectionWrap: {
    gap: 10,
  },
  adminStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  adminStatCard: {
    minWidth: 210,
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaf5",
    padding: 14,
    shadowColor: "#1d2b53",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  adminStatTitle: {
    color: "#6a7391",
    fontSize: 12,
    fontWeight: "700",
  },
  adminStatValue: {
    color: "#151f46",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
  },
  adminStatSub: {
    color: "#7b859f",
    fontSize: 11,
    marginTop: 4,
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "stretch",
  },
  analyticsCard: {
    flexGrow: 1,
    flexBasis: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
    overflow: "hidden",
    shadowColor: "#1d2b53",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  chartEmptyState: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d9deea",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#fafbff",
  },
  chartEmptyText: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  chartFootnote: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  progressList: {
    gap: 10,
  },
  progressRow: {
    gap: 6,
  },
  progressRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  progressLabel: {
    color: "#1f2750",
    fontSize: 13,
    fontWeight: "800",
  },
  progressValue: {
    color: "#5b2ff4",
    fontSize: 13,
    fontWeight: "900",
  },
  progressSubLabel: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "600",
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#edf0f7",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5b2ff4",
  },
  learningSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pendingWithdrawalRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#edf0f7",
    backgroundColor: "#fbfcff",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },  adminFilterWrap: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaf5",
    padding: 12,
    gap: 8,
  },
  adminFilterSearch: {
    marginBottom: 2,
  },
  adminFilterGroup: {
    gap: 6,
  },
  adminFilterLabel: {
    color: "#58637f",
    fontSize: 11,
    fontWeight: "700",
  },
  adminFilterOptions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  adminFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe0f2",
    backgroundColor: "#f8f9ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adminFilterChipActive: {
    borderColor: "#4d56dc",
    backgroundColor: "#eceeff",
  },
  adminFilterChipText: {
    color: "#5c6782",
    fontWeight: "700",
    fontSize: 11,
  },
  adminFilterChipTextActive: {
    color: "#353fc5",
  },
  toggleRowGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe0f2",
    backgroundColor: "#f7f9ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipBtnActive: {
    borderColor: "#4d56dc",
    backgroundColor: "#eceeff",
  },
  chipBtnText: {
    color: "#5c6782",
    fontSize: 11,
    fontWeight: "700",
  },
  chipBtnTextActive: {
    color: "#353fc5",
  },
  adminTableWrap: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaf5",
    overflow: "hidden",
  },
  adminTableHead: {
    flexDirection: "row",
    backgroundColor: "#f4f6fd",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  adminTableHeadText: {
    flex: 1,
    minWidth: 90,
    color: "#4b5672",
    fontSize: 11,
    fontWeight: "800",
  },
  adminTableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#edf1fb",
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  adminTableCell: {
    flex: 1,
    minWidth: 90,
    color: "#2b3551",
    fontSize: 11,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusBadgeGood: {
    backgroundColor: "#e6f8ee",
  },
  statusBadgeWarn: {
    backgroundColor: "#fff4dd",
  },
  statusBadgeBad: {
    backgroundColor: "#ffe6e9",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#344055",
  },
  detailPanel: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaf5",
    padding: 14,
    gap: 8,
    shadowColor: "#1d2b53",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 13, 35, 0.45)",
  },
  modalCard: {
    width: "78%",
    maxWidth: 920,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8eaf5",
    padding: 18,
    gap: 8,
    shadowColor: "#151f46",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  tabButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8ddf1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: "#4b53d9",
    borderColor: "#4b53d9",
  },
  tabText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  tabTextActive: {
    color: "#fff",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  kpiCard: {
    minWidth: 210,
    flexGrow: 1,
    minHeight: 116,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8eaf5",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#27355c",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  kpiIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiIconpurple: {
    backgroundColor: "#efe8ff",
  },
  kpiIconblue: {
    backgroundColor: "#e7f0ff",
  },
  kpiIcongreen: {
    backgroundColor: "#e5f8ea",
  },
  kpiIconorange: {
    backgroundColor: "#fff0dd",
  },
  kpiIconviolet: {
    backgroundColor: "#eee8ff",
  },
  kpiIconText: {
    fontSize: 13,
    fontWeight: "900",
  },
  kpiIconTextpurple: {
    color: "#682df0",
  },
  kpiIconTextblue: {
    color: "#1b73e8",
  },
  kpiIconTextgreen: {
    color: "#1c9b4c",
  },
  kpiIconTextorange: {
    color: "#e58100",
  },
  kpiIconTextviolet: {
    color: "#7b4bff",
  },
  kpiCopy: {
    flex: 1,
    minWidth: 0,
  },
  kpiLabel: {
    color: "#636b8a",
    fontWeight: "700",
    fontSize: 12,
  },
  kpiValue: {
    marginTop: 4,
    color: "#101945",
    fontWeight: "800",
    fontSize: 24,
  },
  kpiDelta: {
    marginTop: 2,
    color: "#5aa978",
    fontSize: 11,
    fontWeight: "600",
  },
  kpiDeltaBad: {
    color: "#e14756",
  },
  gridThreeCols: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
  },
  gridFourCols: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
  },
  colSpanTwo: {
    flex: 2,
  },
  activityCard: {
    flex: 1.25,
  },
  colStack: {
    flex: 1,
    gap: 14,
  },
  softCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8eaf5",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 10,
    shadowColor: "#1d2b53",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cardHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardLink: {
    color: "#5562d9",
    fontSize: 12,
    fontWeight: "700",
  },
  cardFilter: {
    color: "#6f7997",
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  rowItemColumn: {
    borderRadius: 7,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf0f8",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  simpleListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4fb",
    paddingBottom: 8,
  },
  rowMain: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  lineChart: {
    borderRadius: 7,
    minHeight: 205,
    borderWidth: 1,
    borderColor: "#edf0f8",
    backgroundColor: "#fafbff",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    padding: 18,
  },
  linePointWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  lineBar: {
    width: 9,
    borderRadius: 4,
    backgroundColor: "#5a32ea",
  },
  chartLegendRow: {
    flexDirection: "row",
    gap: 10,
  },
  categoryPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  categoryDonut: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 22,
    borderTopColor: "#5b2ff4",
    borderRightColor: "#2979ff",
    borderBottomColor: "#24aa5a",
    borderLeftColor: "#ffab14",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  categoryDonutInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryDonutCurrency: {
    color: "#17234c",
    fontSize: 12,
    fontWeight: "900",
  },
  categoryDonutTotal: {
    color: "#17234c",
    fontSize: 24,
    fontWeight: "900",
  },
  categoryDonutLabel: {
    color: "#65708a",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryLegend: {
    flex: 1,
    gap: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  categoryName: {
    flex: 0.8,
    color: "#344055",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryAmount: {
    flex: 1.2,
    color: "#58637f",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  legendItem: {
    color: "#65708a",
    fontSize: 11,
    fontWeight: "700",
  },
  alertFooterLink: {
    color: "#5968e2",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  alertIconDanger: {
    backgroundColor: "#ffe7e8",
  },
  alertIconWarning: {
    backgroundColor: "#fff1d8",
  },
  alertIconInfo: {
    backgroundColor: "#ffe9d9",
  },
  alertIconText: {
    color: "#f04438",
    fontSize: 14,
    fontWeight: "900",
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertTime: {
    color: "#465577",
    fontSize: 11,
    fontWeight: "700",
  },
  approvalChart: {
    height: 100,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#edf0f8",
    backgroundColor: "#fafbff",
    position: "relative",
  },
  approvalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4fb364",
    position: "absolute",
  },
  bigStat: {
    color: "#2a344d",
    fontSize: 20,
    fontWeight: "800",
  },
  bigValue: {
    color: "#2a344d",
    fontSize: 32,
    fontWeight: "800",
  },
  goodDelta: {
    color: "#4ea26d",
    fontSize: 11,
    fontWeight: "700",
  },
  donutMock: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 16,
    borderColor: "#5977ef",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  donutCenter: {
    color: "#29324a",
    fontWeight: "800",
    fontSize: 20,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    minWidth: 120,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e6eaf7",
    backgroundColor: "#fbfcff",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    color: "#4a5570",
    fontSize: 11,
    fontWeight: "700",
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f8",
    paddingBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4fb",
    paddingVertical: 8,
  },
  tableCell: {
    flex: 1,
    color: "#344055",
    fontSize: 11,
    fontWeight: "700",
  },
  tableCellSuccess: {
    flex: 1,
    color: "#2ca05e",
    fontSize: 11,
    fontWeight: "700",
  },
  tableCellPending: {
    flex: 1,
    color: "#d5a217",
    fontSize: 11,
    fontWeight: "700",
  },
  tableCellDanger: {
    flex: 1,
    color: "#d54855",
    fontSize: 11,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  footerText: {
    color: "#52607c",
    fontSize: 12,
    fontWeight: "600",
  },
  footerDot: {
    color: "#52607c",
    fontSize: 12,
    fontWeight: "800",
  },
});











