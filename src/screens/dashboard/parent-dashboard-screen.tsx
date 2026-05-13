import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  apiDeactivateParentAccount,
  apiDeleteParentAccount,
  apiDeactivateParentChild,
  apiDeleteParentChild,
  apiCreateParentAllowance,
  apiCreateParentChild,
  apiCreateParentChore,
  apiDeleteParentAllowance,
  apiCreateParentSavingsGoal,
  apiParentAllowances,
  apiParentAllTransactions,
  apiParentAccountBalance,
  apiParentChangeChildPassword,
  apiParentChildSavingsGoals,
  apiParentChildren,
  apiParentChores,
  apiParentDeposit,
  apiParentFundChild,
  apiParentPendingTransactions,
  apiParentPreferences,
  apiParentTransactionStatementPdf,
  apiParentReportPdf,
  apiParentReportSummary,
  apiParentAssignLearningLesson,
  apiParentLearningAssignments,
  apiParentPublishedLessons,
  apiParentSpendingLimit,
  apiParentSupportTickets,
  apiParentNotifications,
  apiParentMarkAllNotificationsRead,
  apiParentMarkNotificationsRead,
  apiParentTransactionDecision,
  apiLogDashboardAction,
  API_BASE_URL,
  apiUpdateParentAllowance,
  apiUpdateParentPreferences,
  apiCreateParentSupportTicket,
  AdminLesson,
  ParentAllowanceSummary,
  ParentAccountBalance,
  ParentChildSummary,
  ParentChoreSummary,
  ParentPendingTransaction,
  ParentSavingsGoalSummary,
  ParentSupportTicket,
  ParentNotification,
  ParentPreferences,
  ParentReportSummary,
  ParentReportExportType,
  StatementIncludeField,
  ParentLearningAssignment,
  ParentTransactionSummary,
} from "../../lib/api";
import { AppButton, AppDateInput, AppInput, AppTimeInput } from "../../ui/controls";

const SIDEBAR_BG = "#3d33a0";
const TEAL = "#1bbfa3";
const MAIN_BG = "#eef0f8";

type ParentDashboardScreenProps = {
  email: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  nin?: string | null;
  profileImageUrl?: string | null;
  onLogout: () => void;
};

type Tab =
  | "home"
  | "children"
  | "goals"
  | "transactions"
  | "allowances"
  | "chores"
  | "learning"
  | "limits"
  | "notifications"
  | "reports"
  | "support"
  | "settings";

type ReportRange = "this_month" | "last_30_days" | "all_time";

const navItems: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "children", label: "My Children", icon: "👶" },
  { key: "goals", label: "Savings Goals", icon: "🎯" },
  { key: "transactions", label: "Transactions", icon: "📋" },
  { key: "allowances", label: "Allowances", icon: "💰" },
  { key: "chores", label: "Chores", icon: "✅" },
  { key: "learning", label: "Learning Content", icon: "🐦" },
  { key: "limits", label: "Spending Limits", icon: "💳" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "support", label: "Support", icon: "🛟" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

const formatMoney = (value: number) => `UGX ${value.toLocaleString()}`;

const buildAllowanceDateTime = (date: string, time: string) => {
  if (!date.trim() || !time.trim()) return null;
  if (!/^\d{2}:\d{2}$/.test(time.trim())) return null;

  const dateTime = `${date.trim()}T${time.trim()}:00`;
  const parsed = new Date(dateTime);
  return Number.isNaN(parsed.getTime()) ? null : dateTime;
};

const formatAllowanceDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const isTransientNetworkMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("backend network failed") || normalized.includes("failed to fetch") || normalized.includes("timed out");
};
const formatCompactMoney = (value: number) => {
  if (value >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `UGX ${(value / 1_000).toFixed(1)}K`;
  return formatMoney(value);
};

const EMPTY_REPORT_SUMMARY: ParentReportSummary = {
  parent: {
    currentBalance: 0,
    totalDeposited: 0,
    depositTransactions: 0,
    totalDepositAmount: 0,
    reservedForActiveAllowances: 0,
    totalSentToChildren: 0,
  },
  children: {
    childCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    totalSpent: 0,
    totalEarned: 0,
    walletBalance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    goalsCompleted: 0,
    choresCompleted: 0,
  },
};

function normalizeReportSummary(summary: unknown): ParentReportSummary {
  if (!summary || typeof summary !== "object") return EMPTY_REPORT_SUMMARY;

  const candidate = summary as Record<string, unknown>;
  const parentRaw = candidate.parent as Record<string, unknown> | undefined;
  const childrenRaw = candidate.children as Record<string, unknown> | undefined;

  // Supports both new nested shape and previous flat shape.
  return {
    parent: {
      currentBalance: Number(parentRaw?.currentBalance ?? 0),
      totalDeposited: Number(parentRaw?.totalDeposited ?? 0),
      depositTransactions: Number(parentRaw?.depositTransactions ?? 0),
      totalDepositAmount: Number(parentRaw?.totalDepositAmount ?? 0),
      reservedForActiveAllowances: Number(parentRaw?.reservedForActiveAllowances ?? 0),
      totalSentToChildren: Number(parentRaw?.totalSentToChildren ?? candidate.totalEarned ?? 0),
    },
    children: {
      childCount: Number(childrenRaw?.childCount ?? 0),
      approvedCount: Number(childrenRaw?.approvedCount ?? candidate.approvedCount ?? 0),
      pendingCount: Number(childrenRaw?.pendingCount ?? candidate.pendingCount ?? 0),
      totalSpent: Number(childrenRaw?.totalSpent ?? candidate.totalSpent ?? 0),
      totalEarned: Number(childrenRaw?.totalEarned ?? candidate.totalEarned ?? 0),
      walletBalance: Number(childrenRaw?.walletBalance ?? 0),
      lifetimeEarned: Number(childrenRaw?.lifetimeEarned ?? 0),
      lifetimeSpent: Number(childrenRaw?.lifetimeSpent ?? 0),
      goalsCompleted: Number(childrenRaw?.goalsCompleted ?? candidate.goalsCompleted ?? 0),
      choresCompleted: Number(childrenRaw?.choresCompleted ?? candidate.choresCompleted ?? 0),
    },
  };
}

function reportRangeLabel(r: ReportRange): string {
  if (r === "this_month") return "This month";
  if (r === "last_30_days") return "Last 30 days";
  return "All time";
}

const REPORT_CHILD_OVERVIEW_FIELDS = [
  "childId",
  "childName",
  "age",
  "walletBalance",
  "walletTotalEarned",
  "walletTotalSpent",
  "savedInGoals",
  "totalSaved",
  "goalsCompleted",
  "badgesEarned",
] as const;

const REPORT_CHILD_FIELD_LABELS: Record<(typeof REPORT_CHILD_OVERVIEW_FIELDS)[number], string> = {
  childId: "Child ID",
  childName: "Name",
  age: "Age",
  walletBalance: "Wallet balance",
  walletTotalEarned: "Wallet total earned",
  walletTotalSpent: "Wallet total spent",
  savedInGoals: "Saved in goals",
  totalSaved: "Total saved",
  goalsCompleted: "Goals completed",
  badgesEarned: "Badges earned",
};

const REPORT_FULL_EXPORT_SECTIONS = ["summary", "child_overview", "transaction"] as const;

const REPORT_SECTION_LABELS: Record<(typeof REPORT_FULL_EXPORT_SECTIONS)[number], string> = {
  summary: "Summary totals",
  child_overview: "Per-child overview",
  transaction: "Transactions (up to 300)",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "#dc2626" };
  if (score <= 4) return { score, label: "Medium", color: "#d97706" };
  return { score, label: "Strong", color: "#16a34a" };
}


function resolveUploadImageUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("file:") || url.startsWith("blob:")) return url;

  const uploadPath = url.match(/\/uploads\/profiles\/[^?#]+/i)?.[0];
  if (!uploadPath) return url;

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
  return `${baseUrl}${uploadPath}`;
}
export function ParentDashboardScreen({ email, fullName, phoneNumber, nin, profileImageUrl, onLogout }: ParentDashboardScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const mobileTopInset = isMobile && Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 0;
  const mobileBottomInset = isMobile ? (Platform.OS === "android" ? 44 : 28) : 0;

  const [tab, setTab] = useState<Tab>("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCreateChildForm, setShowCreateChildForm] = useState(false);
  const sidebarTranslateX = useMemo(() => new Animated.Value(-280), []);
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const username = fullName?.trim() || email.split("@")[0];
  const [greetingTime, setGreetingTime] = useState(() => new Date());
  const greeting = useMemo(() => {
    const hour = greetingTime.getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 17) return "Good Afternoon!";
    return "Good evening!";
  }, [greetingTime]);

  useEffect(() => {
    const timer = setInterval(() => setGreetingTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const [children, setChildren] = useState<ParentChildSummary[]>([]);
  const [pending, setPending] = useState<ParentPendingTransaction[]>([]);
  const [chores, setChores] = useState<ParentChoreSummary[]>([]);
  const [allowances, setAllowances] = useState<ParentAllowanceSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const safeError = error && isTransientNetworkMessage(error) ? "" : error && /unauthorized/i.test(error) ? "Please log in to continue." : error;

  const [childFullName, setChildFullName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childCreateConfirmPassword, setChildCreateConfirmPassword] = useState("");
  const [childProfileImageUrl, setChildProfileImageUrl] = useState("");
  const [childNickname, setChildNickname] = useState("");
  const [childAge, setChildAge] = useState("10");

  const [selectedChildId, setSelectedChildId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [limitPeriodType, setLimitPeriodType] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [limitFormLockedChildId, setLimitFormLockedChildId] = useState<string | null>(null);

  const [choreTitle, setChoreTitle] = useState("");
  const [choreDescription, setChoreDescription] = useState("");
  const [choreRewardAmount, setChoreRewardAmount] = useState("2000");
  const [choreDueDate, setChoreDueDate] = useState("");

  const [allowanceTitle, setAllowanceTitle] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [allowanceDate, setAllowanceDate] = useState("");
  const [allowanceTime, setAllowanceTime] = useState("");
  const [allowanceNotes, setAllowanceNotes] = useState("");
  const [showAllowanceForm, setShowAllowanceForm] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const [allowanceChildDropdownOpen, setAllowanceChildDropdownOpen] = useState(false);
  const [choreChildDropdownOpen, setChoreChildDropdownOpen] = useState(false);
  const [showAssignChoreForm, setShowAssignChoreForm] = useState(false);
  const [selectedChoreForDetails, setSelectedChoreForDetails] = useState<ParentChoreSummary | null>(null);
  const [limitsChildDropdownOpen, setLimitsChildDropdownOpen] = useState(false);
  const [goalsChildDropdownOpen, setGoalsChildDropdownOpen] = useState(false);
  const [fundChildDropdownOpen, setFundChildDropdownOpen] = useState(false);
  /** PDF export modal only — not shown on the transactions page */
  const [pdfExportChildId, setPdfExportChildId] = useState("all");
  const [pdfExportTxType, setPdfExportTxType] = useState<"all" | "earn" | "spend">("all");
  const [pdfExportTxStatus, setPdfExportTxStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [pdfExportChildDropdownOpen, setPdfExportChildDropdownOpen] = useState(false);
  const [pdfExportTypeDropdownOpen, setPdfExportTypeDropdownOpen] = useState(false);
  const [pdfExportStatusDropdownOpen, setPdfExportStatusDropdownOpen] = useState(false);
  const [pdfExportColumnsDropdownOpen, setPdfExportColumnsDropdownOpen] = useState(false);
  const [pdfExportIncludeFields, setPdfExportIncludeFields] = useState<StatementIncludeField[]>([
    "date",
    "child",
    "type",
    "status",
    "description",
    "amount",
  ]);
  const [showTransactionPdfModal, setShowTransactionPdfModal] = useState(false);

  const [savingsGoals, setSavingsGoals] = useState<ParentSavingsGoalSummary[]>([]);
  const [allChildGoals, setAllChildGoals] = useState<Array<ParentSavingsGoalSummary & { childId: string; childName: string }>>([]);
  const [goalViewChildId, setGoalViewChildId] = useState("all");
  const [allTransactions, setAllTransactions] = useState<ParentTransactionSummary[]>([]);
  const [mobileTransactionsView, setMobileTransactionsView] = useState<"all" | "withdrawals">("all");
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [learningAssignments, setLearningAssignments] = useState<ParentLearningAssignment[]>([]);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalChildId, setGoalChildId] = useState("");
  const [showCreateGoalOnly, setShowCreateGoalOnly] = useState(false);

  const [fundChildId, setFundChildId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundDescription, setFundDescription] = useState("");
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundFormLockedChildId, setFundFormLockedChildId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [parentAccount, setParentAccount] = useState<ParentAccountBalance>({
    balance: 0,
    totalDeposited: 0,
  });

  const [accountFullName, setAccountFullName] = useState(fullName ?? "");
  const [accountNin, setAccountNin] = useState(nin ?? "");
  const [accountPhone, setAccountPhone] = useState(phoneNumber ?? "");
  const [accountEmail, setAccountEmail] = useState(email);
  const accountDisplayName = accountFullName.trim() || fullName?.trim() || username;
  const accountDisplayPhone = accountPhone.trim() || phoneNumber || "Not saved";
  const accountDisplayEmail = accountEmail.trim() || email;
  const accountDisplayNin = accountNin.trim() || nin || "Not saved";


  const [passwordChildId, setPasswordChildId] = useState("");
  const [childNewPassword, setChildNewPassword] = useState("");
  const [childConfirmPassword, setChildConfirmPassword] = useState("");
  const [withdrawalApprovalRequired, setWithdrawalApprovalRequired] = useState(true);
  const [enableAccountFreeze, setEnableAccountFreeze] = useState(false);
  const [merchantRestrictions, setMerchantRestrictions] = useState("");
  const [quietHours, setQuietHours] = useState("21:00 - 06:00");
  const [notifyDeposits, setNotifyDeposits] = useState(true);
  const [notifyWithdrawals, setNotifyWithdrawals] = useState(true);
  const [notifySuspiciousLogins, setNotifySuspiciousLogins] = useState(true);
  const [notifyGoals, setNotifyGoals] = useState(true);
  const [supportIssueType, setSupportIssueType] = useState("Failed approval");
  const [supportMessage, setSupportMessage] = useState("");
  const [learningStudyStartDate, setLearningStudyStartDate] = useState("");
  const [learningStudyEndDate, setLearningStudyEndDate] = useState("");
  const [supportTickets, setSupportTickets] = useState<ParentSupportTicket[]>([]);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [reportSummary, setReportSummary] = useState<ParentReportSummary>(EMPTY_REPORT_SUMMARY);
  const [showReportPdfModal, setShowReportPdfModal] = useState(false);
  const [reportPdfType, setReportPdfType] = useState<ParentReportExportType | null>(null);
  const [reportPdfRange, setReportPdfRange] = useState<ReportRange>("this_month");
  const [reportPdfTxInclude, setReportPdfTxInclude] = useState<StatementIncludeField[]>([
    "date",
    "child",
    "type",
    "status",
    "description",
    "amount",
  ]);
  const [reportPdfChildFields, setReportPdfChildFields] = useState<string[]>([...REPORT_CHILD_OVERVIEW_FIELDS]);
  const [reportPdfFullSections, setReportPdfFullSections] = useState<string[]>([...REPORT_FULL_EXPORT_SECTIONS]);
  const [reportPdfTxColumnsOpen, setReportPdfTxColumnsOpen] = useState(false);

  const totalChildBalance = useMemo(
    () => children.reduce((sum, child) => sum + (child.wallet?.balance ?? 0), 0),
    [children]
  );

  const childPasswordStrength = useMemo(() => getPasswordStrength(childPassword), [childPassword]);

  const completedChores = useMemo(
    () => chores.filter((c) => c.status === "completed").length,
    [chores]
  );

  async function loadAllGoalsForChildren(childList: ParentChildSummary[]) {
    const goalsByChild = await Promise.all(
      childList.map(async (child) => {
        const response = await apiParentChildSavingsGoals(child.id).catch(() => ({ goals: [] as ParentSavingsGoalSummary[] }));
        return response.goals.map((goal) => ({
          ...goal,
          childId: child.id,
          childName: child.nickname,
        }));
      })
    );
    setAllChildGoals(goalsByChild.flat());
  }

  function applyPreferences(preferences: ParentPreferences) {
    setWithdrawalApprovalRequired(preferences.withdrawalApprovalRequired);
    setEnableAccountFreeze(preferences.accountFreezeEnabled);
    setMerchantRestrictions(preferences.merchantRestrictions);
    setQuietHours(preferences.quietHours);
    setNotifyDeposits(preferences.notifyDeposits);
    setNotifyWithdrawals(preferences.notifyWithdrawals);
    setNotifySuspiciousLogins(preferences.notifySuspiciousLogins);
    setNotifyGoals(preferences.notifyGoals);
  }

  async function loadParentMoneyData(showError = false) {
    try {
      const [childrenData, pendingData, transactionsData, parentAccountData] = await Promise.all([
        apiParentChildren(),
        apiParentPendingTransactions(),
        apiParentAllTransactions(),
        apiParentAccountBalance(),
      ]);

      setChildren(childrenData.children);
      setPending(pendingData.pending);
      setAllTransactions(transactionsData.transactions);
      setParentAccount(parentAccountData);
      await loadAllGoalsForChildren(childrenData.children);

      if (childrenData.children.length > 0) {
        if (!selectedChildId) setSelectedChildId(childrenData.children[0].id);
        if (!goalChildId) setGoalChildId(childrenData.children[0].id);
        if (!fundChildId) setFundChildId(childrenData.children[0].id);
        if (!passwordChildId) setPasswordChildId(childrenData.children[0].id);
      }
    } catch (err) {
      if (showError) setError(err instanceof Error ? err.message : "Failed to refresh parent money data.");
    }
  }

  async function loadParentSupplementalData() {
    const notificationFallback = { notifications, unreadCount: unreadNotificationCount };
    const [choresData, allowancesData, lessonsData, learningAssignmentsData, preferencesData, reportsData, supportData, notificationsData] = await Promise.all([
      apiParentChores(),
      apiParentAllowances(),
      apiParentPublishedLessons().catch(() => ({ lessons: [] as AdminLesson[] })),
      apiParentLearningAssignments().catch(() => ({ assignments: [] as ParentLearningAssignment[] })),
      apiParentPreferences(),
      apiParentReportSummary("this_month"),
      apiParentSupportTickets(),
      apiParentNotifications().catch(() => notificationFallback),
    ]);

    setChores(choresData.chores);
    setAllowances(allowancesData.allowances);
    setLessons(lessonsData.lessons);
    setLearningAssignments(learningAssignmentsData.assignments);
    applyPreferences(preferencesData.preferences);
    setReportSummary(normalizeReportSummary(reportsData.summary));
    setSupportTickets(supportData.tickets);
    setNotifications(notificationsData.notifications);
    setUnreadNotificationCount(notificationsData.unreadCount ?? notificationsData.notifications.filter((item) => !item.isRead).length);
  }

  async function loadParentNotifications(showError = false) {
    try {
      const notificationsData = await apiParentNotifications();
      setNotifications(notificationsData.notifications);
      setUnreadNotificationCount(notificationsData.unreadCount ?? notificationsData.notifications.filter((item) => !item.isRead).length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load notifications.";
      if (showError && !isTransientNetworkMessage(message)) setError(message);
    }
  }

  async function loadParentData(showLoading = true) {
    if (showLoading) setLoading(true);
    if (showLoading) setError("");

    try {
      await loadParentMoneyData(showLoading);
      setLoading(false);
      await loadParentSupplementalData();
    } catch (err) {
      if (showLoading) setError(err instanceof Error ? err.message : "Failed to load parent dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParentData();
    const refreshTimer = setInterval(() => {
      void loadParentMoneyData(false);
    }, 7000);
    const supplementalRefreshTimer = setInterval(() => {
      void loadParentSupplementalData().catch(() => undefined);
    }, 60000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(supplementalRefreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      sidebarTranslateX.setValue(0);
      backdropOpacity.setValue(0);
      return;
    }

    const toValue = isSidebarOpen ? 0 : -280;
    const backdropTo = isSidebarOpen ? 1 : 0;

    Animated.parallel([
      Animated.timing(sidebarTranslateX, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: backdropTo,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, isMobile, isSidebarOpen, sidebarTranslateX]);

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

  async function handleMarkNotificationRead(notificationId: string) {
    try {
      await apiParentMarkNotificationsRead([notificationId]);
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)));
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark notification as read.");
    }
  }

  async function handleMarkAllNotificationsRead() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentMarkAllNotificationsRead();
      setStatus(data.message);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadNotificationCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark all notifications as read.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickChildProfileImage() {
    clearMessages();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to choose a child profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setError("Could not read that image. Try another picture.");
      return;
    }

    setChildProfileImageUrl(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
  }

  async function handleCreateChild() {
    const fullName = childFullName.trim();
    const nickname = childNickname.trim();
    const emailValue = childEmail.trim().toLowerCase();
    const passwordValue = childPassword.trim();
    const confirmPasswordValue = childCreateConfirmPassword.trim();
    const age = Number(childAge);

    if (!childProfileImageUrl) {
      setError("Choose a child profile picture.");
      return;
    }
    if (fullName.length < 3) {
      setError("Enter the child's full name (at least 3 characters).");
      return;
    }
    if (nickname.length < 2) {
      setError("Enter a nickname (at least 2 characters).");
      return;
    }
    if (!Number.isInteger(age) || age < 5 || age > 17) {
      setError("Children must be aged 5 to 17 to use the app.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("Enter a valid child email address.");
      return;
    }
    if (childPasswordStrength.score < 5) {
      setError("Use a strong child password with uppercase, lowercase, number, and symbol.");
      return;
    }
    if (passwordValue !== confirmPasswordValue) {
      setError("Child password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentChild({
        fullName,
        email: emailValue,
        password: passwordValue,
        nickname,
        age,
        profileImageUrl: childProfileImageUrl,
      });
      setStatus(data.message);
      setChildFullName("");
      setChildEmail("");
      setChildPassword("");
      setChildCreateConfirmPassword("");
      setChildProfileImageUrl("");
      setChildNickname("");
      setChildAge("10");
      setShowCreateChildForm(false);
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create child account.");
    } finally {
      setSubmitting(false);
    }
  }


  async function handleDeactivateParentAccount() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiDeactivateParentAccount();
      setStatus(data.message);
      onLogout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate parent account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteParentAccount() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiDeleteParentAccount();
      setStatus(data.message);
      onLogout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete parent account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateSelectedChild() {
    if (!passwordChildId) {
      setError("Select a child account first.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiDeactivateParentChild(passwordChildId);
      setStatus(data.message);
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate child account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSelectedChild() {
    if (!passwordChildId) {
      setError("Select a child account first.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiDeleteParentChild(passwordChildId);
      setStatus(data.message);
      setPasswordChildId("");
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete child account.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleDecision(id: string, decision: "approved" | "rejected") {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentTransactionDecision(id, decision);
      setStatus(data.message);
      await loadParentMoneyData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleSetLimit() {
    const monthlyLimit = Number(limitAmount);
    const targetChildId = limitFormLockedChildId ?? selectedChildId;
    if (!targetChildId) {
      setError("Select a child first.");
      return;
    }
    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
      setError("Enter a valid spending limit.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentSpendingLimit({ childId: targetChildId, monthlyLimit, periodType: limitPeriodType });
      setStatus(data.message);
      setLimitAmount("");
      closeLimitForm();
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update limit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateChore() {
    const rewardAmount = Number(choreRewardAmount);
    if (!selectedChildId) {
      setError("Select a child first.");
      return;
    }
    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
      setError("Enter a valid chore reward amount.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentChore({
        childId: selectedChildId,
        title: choreTitle,
        description: choreDescription || undefined,
        rewardAmount,
        dueDate: choreDueDate || undefined,
      });
      setStatus(data.message);
      setChoreTitle("");
      setChoreDescription("");
      setChoreRewardAmount("2000");
      setChoreDueDate("");
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign chore.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAllowance() {
    const amount = Number(allowanceAmount);
    if (!selectedChildId) {
      setError("Select a child first.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid allowance amount.");
      return;
    }
    const availableOn = buildAllowanceDateTime(allowanceDate, allowanceTime);
    if (!availableOn) {
      setError("Choose the allowance date and time.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentAllowance({
        childId: selectedChildId,
        title: allowanceTitle,
        amount,
        availableOn,
        notes: allowanceNotes || undefined,
      });
      setStatus(data.message);
      setAllowanceTitle("");
      setAllowanceAmount("");
      setAllowanceDate("");
      setAllowanceTime("");
      setAllowanceNotes("");
      setAllowanceChildDropdownOpen(false);
      setShowAllowanceForm(false);
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create allowance.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAllowance(allowanceId: string) {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiDeleteParentAllowance(allowanceId);
      setStatus(data.message);
      if (typeof data.parentBalance === "number") {
        setParentAccount((prev) => ({ ...prev, balance: data.parentBalance ?? prev.balance }));
      }
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete allowance.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateAllowance() {
    if (!editingAllowanceId) return;

    const amount = Number(allowanceAmount);
    if (!selectedChildId) {
      setError("Select a child first.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid allowance amount.");
      return;
    }
    const availableOn = buildAllowanceDateTime(allowanceDate, allowanceTime);
    if (!availableOn) {
      setError("Choose the allowance date and time.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiUpdateParentAllowance(editingAllowanceId, {
        childId: selectedChildId,
        title: allowanceTitle,
        amount,
        availableOn,
        notes: allowanceNotes || undefined,
      });
      setStatus(data.message);
      if (typeof data.parentBalance === "number") {
        setParentAccount((prev) => ({ ...prev, balance: data.parentBalance ?? prev.balance }));
      }
      setEditingAllowanceId(null);
      setAllowanceChildDropdownOpen(false);
      setShowAllowanceForm(false);
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update allowance.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeChildPassword() {
    const nextPassword = childNewPassword.trim();
    const nextConfirmPassword = childConfirmPassword.trim();

    if (!passwordChildId) {
      setError("Select a child account first.");
      return;
    }
    if (nextPassword.length < 8) {
      setError("Child password must be at least 8 characters.");
      return;
    }
    if (nextPassword !== nextConfirmPassword) {
      setError("Child password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentChangeChildPassword(passwordChildId, {
        newPassword: nextPassword,
        confirmPassword: nextConfirmPassword,
      });
      setStatus(data.message);
      setChildNewPassword("");
      setChildConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change child password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSavingsGoal() {
    const target = Number(goalTarget);
    if (!goalChildId) { setError("Select a child first."); return; }
    if (!goalTitle.trim()) { setError("Enter a goal title."); return; }
    if (!Number.isFinite(target) || target <= 0) { setError("Enter a valid target amount."); return; }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentSavingsGoal(goalChildId, {
        title: goalTitle,
        targetAmount: target,
        targetDate: goalTargetDate || undefined,
      });
      setStatus(data.message);
      setGoalTitle("");
      setGoalTarget("");
      setGoalTargetDate("");
      await loadParentData();
      const goals = await apiParentChildSavingsGoals(goalChildId);
      setSavingsGoals(goals.goals);
      await loadAllGoalsForChildren(children);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create savings goal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFundChild() {
    const amount = Number(fundAmount);
    if (!fundChildId) { setError("Select a child first."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid amount."); return; }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentFundChild({
        childId: fundChildId,
        amount,
        description: fundDescription || undefined,
      });
      setStatus(data.message);
      setFundAmount("");
      setFundDescription("");
      closeFundWalletForm();
      await loadParentMoneyData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fund child account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleParentDeposit() {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid deposit amount.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentDeposit({ amount });
      setStatus(data.message);
      setDepositAmount("");
      setShowDepositForm(false);
      setParentAccount({ balance: data.balance, totalDeposited: data.totalDeposited });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deposit funds.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePreferences() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiUpdateParentPreferences({
        withdrawalApprovalRequired,
        accountFreezeEnabled: enableAccountFreeze,
        merchantRestrictions,
        quietHours,
        notifyDeposits,
        notifyWithdrawals,
        notifySuspiciousLogins,
        notifyGoals,
      });
      applyPreferences(data.preferences);
      setStatus(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSupportTicket() {
    if (!supportIssueType.trim() || !supportMessage.trim()) {
      setError("Please provide issue type and details.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentSupportTicket({
        issueType: supportIssueType.trim(),
        message: supportMessage.trim(),
      });
      setStatus(data.message);
      setSupportMessage("");
      const refreshed = await apiParentSupportTickets();
      setSupportTickets(refreshed.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit support request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignLearningLesson(lessonId: string) {
    if (!selectedChildId) {
      setError("Select a child before assigning learning content.");
      return;
    }
    if (!learningStudyStartDate || !learningStudyEndDate) {
      setError("Select both study start and study end dates.");
      return;
    }
    const startDate = new Date(learningStudyStartDate);
    const endDate = new Date(learningStudyEndDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Enter valid study dates.");
      return;
    }
    if (endDate < startDate) {
      setError("Study end date must be after start date.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentAssignLearningLesson({
        childId: selectedChildId,
        lessonId,
        studyStartAt: learningStudyStartDate,
        studyEndAt: learningStudyEndDate,
      });
      setStatus(data.message);
      const refreshedAssignments = await apiParentLearningAssignments().catch(() => ({ assignments: [] as ParentLearningAssignment[] }));
      setLearningAssignments(refreshedAssignments.assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign learning lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  function openLessonResource(resourceUrl: string) {
    const fullUrl = resourceUrl.startsWith("http")
      ? resourceUrl
      : `${API_BASE_URL}${resourceUrl.startsWith("/") ? resourceUrl : `/${resourceUrl}`}`;
    const browserRef = globalThis as unknown as { open?: (url: string, target?: string) => void };
    if (typeof browserRef.open === "function") {
      browserRef.open(fullUrl, "_blank");
      return;
    }
    setStatus(`Open this link: ${fullUrl}`);
  }

  function openWithdrawRequestsPage() {
    setMobileTransactionsView("withdrawals");
    handleTabPress("transactions");
  }

  function openTransactionsPage() {
    setMobileTransactionsView("all");
    handleTabPress("transactions");
  }

  function handleTabPress(nextTab: Tab) {
    void apiLogDashboardAction({ dashboard: "parent", action: `Open tab: ${nextTab}` }).catch(() => undefined);
    setTab(nextTab);
    if (nextTab === "notifications") {
      void loadParentNotifications(false);
    }
    if (nextTab !== "children") {
      setShowCreateChildForm(false);
    }
    if (nextTab !== "home") {
      setShowDepositForm(false);
    }
    if (nextTab !== "allowances") {
      setAllowanceChildDropdownOpen(false);
      setShowAllowanceForm(false);
    }
    if (nextTab !== "chores") {
      setChoreChildDropdownOpen(false);
      setShowAssignChoreForm(false);
    }
    if (nextTab !== "limits") {
      closeLimitForm();
    }
    if (nextTab !== "goals") {
      setGoalsChildDropdownOpen(false);
      setShowCreateGoalOnly(false);
    }
    if (nextTab !== "children") {
      setFundChildDropdownOpen(false);
    }
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenAssignChoreForm(childId?: string) {
    if (childId) {
      setSelectedChildId(childId);
      setChoreChildDropdownOpen(false);
    }
    setShowAssignChoreForm(true);
    handleTabPress("chores");
  }

  function handleOpenAllowanceForm(childId?: string) {
    if (childId) {
      setSelectedChildId(childId);
    }
    setEditingAllowanceId(null);
    setAllowanceTitle("");
    setAllowanceAmount("");
    setAllowanceDate("");
    setAllowanceTime("");
    setAllowanceNotes("");
    setAllowanceChildDropdownOpen(false);
    setShowAllowanceForm(true);
    handleTabPress("allowances");
  }

  function handleOpenCreateGoal() {
    setShowCreateGoalOnly(true);
    handleTabPress("goals");
  }

  function handleOpenLimitForm(childId?: string) {
    const nextChildId = childId ?? selectedChildId ?? children[0]?.id ?? "";
    if (nextChildId) {
      setSelectedChildId(nextChildId);
    }
    setLimitFormLockedChildId(childId ? nextChildId : null);
    setLimitsChildDropdownOpen(false);
    setShowLimitForm(true);
    handleTabPress("limits");
  }

  function closeLimitForm() {
    setShowLimitForm(false);
    setLimitFormLockedChildId(null);
    setLimitsChildDropdownOpen(false);
  }

  function openFundWalletForm(childId?: string, navigateToChildren = false) {
    const nextChildId = childId ?? fundChildId ?? children[0]?.id ?? "";
    setFundChildId(nextChildId);
    setFundFormLockedChildId(childId ?? null);
    setFundChildDropdownOpen(false);
    setShowDepositForm(false);
    setShowFundForm(true);
    if (navigateToChildren) handleTabPress("children");
  }

  function closeFundWalletForm() {
    setShowFundForm(false);
    setFundFormLockedChildId(null);
    setFundChildDropdownOpen(false);
  }

  const activeTabLabel = navItems.find((item) => item.key === tab)?.label ?? "Dashboard";
  const notificationBadgeCount = Math.min(9, unreadNotificationCount);
  const openSupportCount = Math.min(9, supportTickets.filter((ticket) => ticket.status === "open").length);
  const visibleGoalRows = allChildGoals.filter((goal) => goalViewChildId === "all" || goal.childId === goalViewChildId);
  const completedGoalRows = visibleGoalRows.filter((goal) => goal.status === "completed");
  const activeSavingsGoals = allChildGoals.filter((goal) => goal.status === "active");
  const goalsOnTrack = allChildGoals.filter((goal) => (goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 >= 50 : false)).length;
  const goalsBehind = Math.max(0, allChildGoals.length - goalsOnTrack);
  const avgGoalProgress = allChildGoals.length === 0
    ? 0
    : Math.round(
        allChildGoals.reduce(
          (sum, goal) => sum + (goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0),
          0
        ) / allChildGoals.length
      );
  const pendingWithdrawalRequests = pending.filter((tx) => tx.type === "spend");
  const pendingWithdrawalCount = pendingWithdrawalRequests.length;
  const approvedTransactions = allTransactions.filter((tx) => tx.status === "approved");
  const totalDeposits = approvedTransactions.filter((tx) => tx.type === "earn").reduce((sum, tx) => sum + tx.amount, 0);
  const totalWithdrawals = approvedTransactions.filter((tx) => tx.type === "spend").reduce((sum, tx) => sum + tx.amount, 0);
  const rewardsPaid = approvedTransactions
    .filter((tx) => tx.type === "earn" && (tx.description ?? "").toLowerCase().includes("chore"))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const pendingChoresCount = chores.filter((chore) => chore.status === "assigned").length;
  const approvedRewardCount = approvedTransactions.filter((tx) => (tx.description ?? "").toLowerCase().includes("chore")).length;
  const totalAllowancesValue = allowances.reduce((sum, item) => sum + item.amount, 0);
  const activeAllowancesCount = allowances.filter((item) => item.isActive).length;
  const scheduledAllowances = allowances.filter((item) => item.isActive);
  const learningProgressPercent = learningAssignments.length === 0
    ? 0
    : Math.round(
        learningAssignments.reduce((sum, assignment) => sum + Number(assignment.progressPercent ?? 0), 0) / learningAssignments.length
      );
  const budgetingSkillsPercent = reportSummary.children.totalEarned > 0
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(((reportSummary.children.totalEarned - reportSummary.children.totalSpent) / reportSummary.children.totalEarned) * 100)
        )
      )
    : 0;
  const badgesEarnedCount = reportSummary.children.goalsCompleted + reportSummary.children.choresCompleted;
  const now = new Date();
  const paidThisMonth = approvedTransactions
    .filter((tx) => (tx.description ?? "").toLowerCase().includes("allowance"))
    .filter((tx) => {
      const date = new Date(tx.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
  const upcomingPayments = allowances
    .filter((item) => {
      const paymentDate = new Date(item.availableOn);
      const diffDays = (paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    })
    .sort((a, b) => new Date(a.availableOn).getTime() - new Date(b.availableOn).getTime());
  const upcomingPaymentsTotal = upcomingPayments.reduce((sum, item) => sum + item.amount, 0);
  const childProgressMetrics = children.map((child) => {
    const childGoals = allChildGoals.filter((goal) => goal.childId === child.id);
    const completedGoals = childGoals.filter((goal) => goal.status === "completed").length;
    const childSavedInGoals = childGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    const completedChildChores = chores.filter((chore) => chore.childId === child.id && chore.status === "completed").length;
    const badgesEarned = completedGoals + completedChildChores;
    const totalSaved = (child.wallet?.balance ?? 0) + childSavedInGoals;

    return {
      child,
      totalSaved,
      completedGoals,
      badgesEarned,
    };
  });
  const selectedChoreCompletionLabel = selectedChoreForDetails?.completedAt
    ? new Date(selectedChoreForDetails.completedAt).toLocaleString()
    : "Not completed yet";
  const selectedChoreDeadlineLabel = selectedChoreForDetails?.dueDate
    ? new Date(selectedChoreForDetails.dueDate).toLocaleString()
    : "No deadline set";
  const selectedChoreDeadlineStatus = selectedChoreForDetails
    ? selectedChoreForDetails.status !== "completed"
      ? "Pending completion"
      : !selectedChoreForDetails.dueDate
        ? "Completed (no deadline)"
        : selectedChoreForDetails.completedAt &&
            new Date(selectedChoreForDetails.completedAt).getTime() <= new Date(selectedChoreForDetails.dueDate).getTime()
          ? "Completed on time"
          : "Completed after deadline"
    : "";
  const pdfExportAccountLabel =
    pdfExportChildId === "all"
      ? "All accounts"
      : pdfExportChildId === "parent_wallet"
        ? "Parent wallet"
        : children.find((child) => child.id === pdfExportChildId)?.nickname ?? "Account";

  function togglePdfExportIncludeField(field: StatementIncludeField) {
    setPdfExportIncludeFields((prev) => {
      if (prev.includes(field)) {
        return prev.length > 1 ? prev.filter((item) => item !== field) : prev;
      }
      return [...prev, field];
    });
  }

  function statementIncludeFieldLabel(field: StatementIncludeField) {
    const labels: Record<StatementIncludeField, string> = {
      date: "Date",
      child: "Account",
      type: "Type",
      status: "Status",
      description: "Description",
      amount: "Amount",
    };
    return labels[field];
  }

  function pdfColumnsTriggerLabel(fields: StatementIncludeField[]) {
    if (fields.length === 0) return "Select columns…";
    if (fields.length === 6) return "All columns";
    const labels = fields.map((f) => statementIncludeFieldLabel(f)).join(", ");
    return labels.length > 42 ? `${fields.length} of 6 columns` : labels;
  }

  function closePdfExportDropdownsExcept(except: "account" | "type" | "status" | "columns" | "none") {
    if (except !== "account") setPdfExportChildDropdownOpen(false);
    if (except !== "type") setPdfExportTypeDropdownOpen(false);
    if (except !== "status") setPdfExportStatusDropdownOpen(false);
    if (except !== "columns") setPdfExportColumnsDropdownOpen(false);
  }
  function openReportPdfModal(type: ParentReportExportType) {
    setReportPdfType(type);
    setReportPdfRange("this_month");
    setReportPdfTxInclude(["date", "child", "type", "status", "description", "amount"]);
    setReportPdfChildFields([...REPORT_CHILD_OVERVIEW_FIELDS]);
    setReportPdfFullSections([...REPORT_FULL_EXPORT_SECTIONS]);
    setReportPdfTxColumnsOpen(false);
    setShowReportPdfModal(true);
  }

  function toggleReportPdfTxField(field: StatementIncludeField) {
    setReportPdfTxInclude((prev) => {
      if (prev.includes(field)) {
        return prev.length > 1 ? prev.filter((item) => item !== field) : prev;
      }
      return [...prev, field];
    });
  }

  function toggleReportPdfChildField(key: string) {
    setReportPdfChildFields((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((item) => item !== key) : prev;
      }
      return [...prev, key];
    });
  }

  function toggleReportPdfSection(section: string) {
    setReportPdfFullSections((prev) => {
      if (prev.includes(section)) {
        return prev.length > 1 ? prev.filter((item) => item !== section) : prev;
      }
      return [...prev, section];
    });
  }

  function buildReportPdfInclude(): string | undefined {
    if (!reportPdfType) return undefined;
    if (reportPdfType === "transactions" || reportPdfType === "pending") {
      return reportPdfTxInclude.join(",");
    }
    if (reportPdfType === "children-overview") {
      return reportPdfChildFields.join(",");
    }
    if (reportPdfType === "full-export") {
      return reportPdfFullSections.join(",");
    }
    return undefined;
  }

  function reportPdfTypeLabel(type: ParentReportExportType): string {
    if (type === "transactions") return "Transaction history";
    if (type === "pending") return "Pending requests";
    if (type === "children-overview") return "Spending summary";
    if (type === "full-export") return "Monthly report";
    return "Report";
  }

  async function handleDownloadReportPdf() {
    if (!reportPdfType) return;
    try {
      clearMessages();
      setSubmitting(true);
      const include = buildReportPdfInclude();
      const response = await apiParentReportPdf(reportPdfType, reportPdfRange, include ? { include } : undefined);

      if (!response.pdfBase64) {
        setError("Could not generate report PDF.");
        return;
      }

      if (typeof document !== "undefined") {
        const binary = atob(response.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: response.mimeType || "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setStatus(`Downloaded ${response.filename}`);
        setShowReportPdfModal(false);
        setReportPdfTxColumnsOpen(false);
      } else {
        setError("PDF download is available on web for now.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download report PDF.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportTransactionStatementPdf() {
    try {
      clearMessages();
      setSubmitting(true);
      const response = await apiParentTransactionStatementPdf({
        childId: pdfExportChildId === "all" ? undefined : pdfExportChildId,
        txType: pdfExportTxType,
        txStatus: pdfExportTxStatus,
        include: pdfExportIncludeFields,
      });

      if (!response.pdfBase64) {
        setError("Could not generate statement PDF.");
        return;
      }

      if (typeof document !== "undefined") {
        const binary = atob(response.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: response.mimeType || "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setStatus(`Downloaded ${response.filename}`);
        setPdfExportChildDropdownOpen(false);
        setPdfExportTypeDropdownOpen(false);
        setPdfExportStatusDropdownOpen(false);
        setPdfExportColumnsDropdownOpen(false);
        setShowTransactionPdfModal(false);
      } else {
        setError("PDF download is available on web for now.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export statement PDF.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile, isMobile ? { paddingTop: mobileTopInset } : null]}>

      {isMobile ? (
        <Animated.View
          pointerEvents={isSidebarOpen ? "auto" : "none"}
          style={[styles.mobileBackdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={styles.mobileBackdropTap} onPress={() => setIsSidebarOpen(false)} />
        </Animated.View>
      ) : null}

      {/* ── Sidebar ── */}
      <Animated.View
        style={[
          styles.sidebar,
          isMobile && styles.sidebarMobile,
          isMobile && styles.sidebarMobileDrawer,
          isMobile ? { transform: [{ translateX: sidebarTranslateX }] } : null,
        ]}
      >
        <View style={[styles.sidebarBrand, isMobile && styles.sidebarBrandMobile]}>
          <Text style={[styles.brandText, isMobile && styles.brandTextMobile]}>Kids Banking</Text>
        </View>

        <View style={styles.sidebarProfileBlock}>
          <View style={styles.sidebarProfileImageWrap}>
            {profileImageUrl ? (
              <Image source={{ uri: resolveUploadImageUrl(profileImageUrl) ?? profileImageUrl }} style={styles.sidebarProfileImage} resizeMode="cover" />
            ) : (
              <Text style={styles.sidebarProfileInitial}>{username[0]?.toUpperCase() ?? "?"}</Text>
            )}
          </View>
          <Text style={styles.sidebarProfileName} numberOfLines={1}>{username}</Text>
        </View>

        <ScrollView
          style={[styles.navList, isMobile && styles.navListMobile]}
          contentContainerStyle={isMobile ? styles.navListMobileInner : undefined}
          showsVerticalScrollIndicator={isMobile}
          showsHorizontalScrollIndicator={false}
          horizontal={false}
        >
          {navItems.map((item) => {
            const active = item.key === tab;
            const badgeCount = item.key === "notifications" ? notificationBadgeCount : item.key === "support" ? openSupportCount : 0;
            return (
              <Pressable
                key={item.key}
                onPress={() => handleTabPress(item.key)}
                style={[styles.navItem, isMobile && styles.navItemMobile, active && styles.navItemActive]}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <View style={styles.navLabelWrap}>
                  <Text
                    style={[styles.navLabel, isMobile && styles.navLabelMobile, active && styles.navLabelActive]}
                  >
                    {item.label}
                  </Text>
                  {badgeCount > 0 ? (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{badgeCount}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onLogout}
            style={[styles.navItem, isMobile && styles.navItemMobile]}
          >
            <Text style={styles.navIcon}>⎋</Text>
            <View style={styles.navLabelWrap}>
              <Text style={[styles.navLabel, isMobile && styles.navLabelMobile]}>Logout</Text>
            </View>
          </Pressable>
        </ScrollView>
      </Animated.View>

      {/* ── Main Content ── */}
      <ScrollView
        style={styles.main}
        contentContainerStyle={[
          styles.mainInner,
          isMobile && styles.mainInnerMobile,
          isMobile ? { paddingBottom: 124 + mobileBottomInset } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isMobile && tab !== "home" ? (
          <View style={styles.mobileMenuBar}>
            <Pressable style={styles.mobileMenuButton} onPress={() => setIsSidebarOpen(true)}>
              <Text style={styles.mobileMenuIcon}>☰</Text>
            </Pressable>
            <Text style={styles.mobileMenuTitle}>{activeTabLabel}</Text>
          </View>
        ) : null}

        {isMobile && tab === "home" ? (
          <View style={styles.mobileHealthHeader}>
            <View style={styles.mobileProfileWrap}>
              <View style={styles.mobileAvatarChip}>
                <Text style={styles.mobileAvatarChipText}>{username[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View>
                <Text style={styles.mobileHealthTitle}>Hello {username}</Text>
                <Text style={styles.mobileHealthSubtitle}>Welcome back</Text>
              </View>
            </View>
            <View style={styles.mobileHealthHeaderActions}>
              <Pressable style={styles.mobileCircleBtn} onPress={() => handleTabPress("notifications")}>
                <Text style={styles.mobileCircleBtnIcon}>🔔</Text>
                {notificationBadgeCount > 0 ? (
                  <View style={styles.mobileHeaderBadge}>
                    <Text style={styles.mobileHeaderBadgeText}>{notificationBadgeCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable style={styles.mobileCircleBtn} onPress={() => openTransactionsPage()}>
                <Text style={styles.mobileCircleBtnIcon}>⌕</Text>
              </Pressable>
              <Pressable style={styles.mobileCircleBtn} onPress={() => setIsSidebarOpen(true)}>
                <Text style={styles.mobileCircleBtnIcon}>☰</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {status ? <Text style={styles.statusMsg}>{status}</Text> : null}
        {safeError ? <Text style={styles.errorMsg}>{safeError}</Text> : null}
        {loading ? <Text style={styles.loadingMsg}>Loading…</Text> : null}

        {/* HOME */}
        {!loading && tab === "home" && (
          <View style={styles.section}>
            {isMobile ? (
              <>
                <View style={styles.mobileBalanceCard}>
                  <View style={styles.mobileBalanceHeader}>
                    <Text style={styles.mobileBalanceCaption}>Total Balance</Text>
                    <View style={styles.mobileBalancePill}>
                      <Text style={styles.mobileBalancePillText}>Family</Text>
                    </View>
                  </View>
                  <Text style={styles.mobileBalanceAmount}>{formatMoney(parentAccount.balance)}</Text>
                  <Text style={styles.mobileBalanceSubtext}>
                    Parent account • {reportSummary.children.childCount} children • {reportSummary.children.pendingCount} pending approvals
                  </Text>
                </View>

                <View style={styles.mobileQuickActionRow}>
                  <Pressable style={styles.mobileQuickActionBtn} onPress={() => handleTabPress("children")}>
                    <View style={styles.mobileQuickActionIconWrap}>
                      <Text style={styles.mobileQuickActionIcon}>➕</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Add Child</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.mobileQuickActionBtn, pendingWithdrawalCount > 0 && styles.mobileQuickActionAlert]}
                    onPress={() => openWithdrawRequestsPage()}
                  >
                    {pendingWithdrawalCount > 0 ? (
                      <View style={styles.mobileQuickActionBadge}>
                        <Text style={styles.mobileQuickActionBadgeText}>{pendingWithdrawalCount}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.mobileQuickActionIconWrap, pendingWithdrawalCount > 0 && styles.mobileQuickActionIconWrapAlert]}>
                      <Text style={styles.mobileQuickActionIcon}>UGX</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Withdraw Requests</Text>
                  </Pressable>
                  <Pressable style={styles.mobileQuickActionBtn} onPress={handleOpenCreateGoal}>
                    <View style={styles.mobileQuickActionIconWrap}>
                      <Text style={styles.mobileQuickActionIcon}>◎</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Goals</Text>
                  </Pressable>
                  <Pressable style={styles.mobileQuickActionBtn} onPress={() => setShowDepositForm((prev) => !prev)}>
                    <View style={styles.mobileQuickActionIconWrap}>
                      <Text style={styles.mobileQuickActionIcon}>⬆</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Deposit</Text>
                  </Pressable>
                </View>
                {pendingWithdrawalCount > 0 ? (
                  <Pressable style={styles.mobileWithdrawalAlertCard} onPress={() => openWithdrawRequestsPage()}>
                    <View style={styles.mobileWithdrawalAlertIconWrap}>
                      <Text style={styles.mobileWithdrawalAlertIcon}>UGX</Text>
                    </View>
                    <View style={styles.mobileWithdrawalAlertTextWrap}>
                      <Text style={styles.mobileWithdrawalAlertTitle}>Withdraw request waiting</Text>
                      <Text style={styles.mobileWithdrawalAlertText}>
                        {pendingWithdrawalCount} child {pendingWithdrawalCount === 1 ? "request needs" : "requests need"} your approval.
                      </Text>
                    </View>
                    <Text style={styles.mobileWithdrawalAlertLink}>Review</Text>
                  </Pressable>
                ) : null}
                {showDepositForm ? (
                  <View style={[styles.formCard, styles.mobileSurfaceCard]}>
                    <Text style={styles.formCardTitle}>Deposit to Parent Account</Text>
                    <AppInput label="Amount (UGX)" value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" />
                    <AppButton title="Deposit Money" loading={submitting} onPress={handleParentDeposit} />
                  </View>
                ) : null}

                <View style={styles.mobileLatestHeader}>
                  <Text style={styles.mobileLatestTitle}>Latest Transactions</Text>
                  <Pressable onPress={() => openTransactionsPage()}>
                    <Text style={styles.mobileLatestLink}>View All</Text>
                  </Pressable>
                </View>

                <View style={styles.mobileDeviceList}>
                  {allTransactions.length === 0 ? (
                    <Text style={styles.activityEmpty}>No transactions yet.</Text>
                  ) : (
                    allTransactions.slice(0, 5).map((item) => (
                      <Pressable key={item.id} style={styles.mobileDeviceRow} onPress={() => openTransactionsPage()}>
                        <View style={styles.mobileDeviceIcon}><Text style={styles.mobileDeviceIconText}>{item.type === "earn" ? "↗" : "↘"}</Text></View>
                        <View style={styles.mobileDeviceInfo}>
                          <Text style={styles.mobileDeviceTitle}>{item.description ?? `${item.type === "earn" ? "Credit" : "Spend"} Transaction`}</Text>
                          <Text style={styles.mobileDeviceMeta}>{item.childName} • {new Date(item.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <Text style={[styles.mobileDeviceAmount, item.type === "earn" ? styles.mobileDeviceAmountPositive : styles.mobileDeviceAmountNegative]}>
                          {item.type === "earn" ? "+ " : "- "}{formatMoney(item.amount)}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.desktopHeaderRow}>
                  <View>
                    <Text style={styles.desktopTitle}>Welcome back, {username}! 👋</Text>
                    <Text style={styles.desktopSubtitle}>Here's what's happening with your family accounts today.</Text>
                  </View>
                  <Text style={styles.desktopGreeting}>{greeting}</Text>
                </View>

                <View style={styles.desktopQuickActions}>
                  <Pressable style={styles.desktopActionButton} onPress={() => handleTabPress("children")}>
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>👶</Text></View>
                    <Text style={styles.desktopActionText}>Add Child</Text>
                  </Pressable>
                  <Pressable
                    style={styles.desktopActionButton}
                    onPress={() => openFundWalletForm()}
                  >
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>💳</Text></View>
                    <Text style={styles.desktopActionText}>Fund Wallet</Text>
                  </Pressable>
                  <Pressable style={styles.desktopActionButton} onPress={handleOpenCreateGoal}>
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>🎯</Text></View>
                    <Text style={styles.desktopActionText}>Create Goal</Text>
                  </Pressable>
                  <Pressable style={styles.desktopActionButton} onPress={() => handleOpenAssignChoreForm()}>
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>✅</Text></View>
                    <Text style={styles.desktopActionText}>Assign Chore</Text>
                  </Pressable>
                  <Pressable style={styles.desktopActionButton} onPress={() => setShowDepositForm((prev) => !prev)}>
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>⬆️</Text></View>
                    <Text style={styles.desktopActionText}>Deposit Money</Text>
                  </Pressable>
                </View>
                {showDepositForm ? (
                  <View style={styles.desktopPanel}>
                    <Text style={styles.sectionTitle}>Deposit to Parent Account</Text>
                    <AppInput label="Amount (UGX)" value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" />
                    <AppButton title="Deposit Money" loading={submitting} onPress={handleParentDeposit} />
                  </View>
                ) : null}

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Children Managed</Text>
                    <Text style={styles.desktopKpiValue}>{reportSummary.children.childCount}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Parent Account Balance</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(parentAccount.balance)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Pending Approvals</Text>
                    <Text style={styles.desktopKpiValue}>{reportSummary.children.pendingCount}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Active Savings Goals</Text>
                    <Text style={styles.desktopKpiValue}>{activeSavingsGoals.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Completed Chores</Text>
                    <Text style={styles.desktopKpiValue}>{reportSummary.children.choresCompleted}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Learning Progress</Text>
                    <Text style={styles.desktopKpiValue}>{learningProgressPercent}%</Text>
                  </View>
                </View>

                <View style={styles.desktopTopPanels}>
                  <View style={styles.desktopPanel}>
                    <View style={styles.desktopPanelHeader}>
                      <Text style={styles.sectionTitle}>Your Children</Text>
                      <Pressable onPress={() => handleTabPress("children")}>
                        <Text style={styles.desktopPanelLink}>View all</Text>
                      </Pressable>
                    </View>
                    <View style={styles.childGrid}>
                      {children.slice(0, 2).map((child) => (
                        <View key={child.id} style={styles.desktopChildCard}>
                          <View style={styles.childCardLeft}>
                            <View style={styles.childAvatar}>
                              {resolveUploadImageUrl(child.profileImageUrl) ? (
                                <Image source={{ uri: resolveUploadImageUrl(child.profileImageUrl)! }} style={styles.childAvatarImage} resizeMode="cover" />
                              ) : (
                                <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.childCardRight}>
                            <Text style={styles.childName}>{child.nickname}</Text>
                            <Text style={styles.childEmail}>Age {child.age}</Text>
                            <View style={styles.childStat}>
                              <Text style={styles.childStatLabel}>Wallet Balance</Text>
                              <Text style={styles.childStatValue}>{formatMoney(child.wallet?.balance ?? 0)}</Text>
                            </View>
                            <View style={styles.desktopChildActions}>
                              <Pressable style={styles.desktopSmallBtn} onPress={() => handleTabPress("children")}>
                                <Text style={styles.desktopSmallBtnText}>View Profile</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                onPress={() => openFundWalletForm(child.id)}
                              >
                                <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Fund Wallet</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                    {children.length === 0 ? <Text style={styles.emptyText}>No children added yet.</Text> : null}
                  </View>

                  <View style={styles.desktopPanel}>
                    <View style={styles.desktopPanelHeader}>
                      <Text style={styles.sectionTitle}>Pending Approvals</Text>
                      <Pressable onPress={() => openTransactionsPage()}>
                        <Text style={styles.desktopPanelLink}>View all</Text>
                      </Pressable>
                    </View>
                    {pending.length === 0 ? (
                      <Text style={styles.activityEmpty}>No pending approvals.</Text>
                    ) : (
                      pending.slice(0, 4).map((item) => (
                        <View key={item.id} style={styles.desktopPendingRow}>
                          <Text style={styles.desktopPendingCell}>{item.childName}</Text>
                          <Text style={styles.desktopPendingCell}>{item.type}</Text>
                          <Text style={styles.desktopPendingCell}>{formatMoney(item.amount)}</Text>
                          <View style={styles.desktopPendingActions}>
                            <Pressable style={[styles.decisionBtn, styles.approveBtn]} onPress={() => handleDecision(item.id, "approved")}>
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </Pressable>
                            <Pressable style={[styles.decisionBtn, styles.rejectBtn]} onPress={() => handleDecision(item.id, "rejected")}>
                              <Text style={styles.rejectBtnText}>Reject</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.desktopBottomPanels}>
                  <View style={styles.desktopPanel}>
                    <View style={styles.desktopPanelHeader}>
                      <Text style={styles.sectionTitle}>Recent Transactions</Text>
                      <Pressable onPress={() => openTransactionsPage()}>
                        <Text style={styles.desktopPanelLink}>View all</Text>
                      </Pressable>
                    </View>
                    {allTransactions.slice(0, 5).map((tx) => (
                      <View key={tx.id} style={styles.desktopSimpleRow}>
                        <Text style={styles.listItemMain}>{tx.childName} - {tx.description ?? tx.type}</Text>
                        <Text style={styles.listItemMeta}>
                          {tx.type === "earn" ? "+" : "-"} {formatMoney(tx.amount)}
                        </Text>
                      </View>
                    ))}
                    {allTransactions.length === 0 ? <Text style={styles.activityEmpty}>No transactions yet.</Text> : null}
                  </View>

                  <View style={styles.desktopPanel}>
                    <View style={styles.desktopPanelHeader}>
                      <Text style={styles.sectionTitle}>Savings Goals</Text>
                      <Pressable onPress={() => handleTabPress("goals")}>
                        <Text style={styles.desktopPanelLink}>View all</Text>
                      </Pressable>
                    </View>
                    {activeSavingsGoals.slice(0, 4).map((goal) => {
                      const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                      return (
                        <View key={goal.id} style={styles.desktopGoalRow}>
                          <Text style={styles.listItemMain}>{goal.title} - {goal.childName}</Text>
                          <Text style={styles.listItemMeta}>{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}</Text>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                          </View>
                        </View>
                      );
                    })}
                    {activeSavingsGoals.length === 0 ? <Text style={styles.activityEmpty}>No active goals yet.</Text> : null}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* MY CHILDREN */}
        {!loading && tab === "children" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.childrenTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>My Children</Text>
                    <Text style={styles.childrenSubtitle}>Manage your children's wallets, goals, chores, and learning progress.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <View style={styles.childrenSearchPill}>
                      <Text style={styles.childrenSearchText}>Search children...</Text>
                    </View>
                    <Pressable style={styles.childrenTopBtn} onPress={() => openFundWalletForm()}>
                      <Text style={styles.childrenTopBtnText}>Fund Wallet</Text>
                    </Pressable>
                    <Pressable style={styles.childrenTopBtn} onPress={() => handleTabPress("limits")}>
                      <Text style={styles.childrenTopBtnText}>Set Spending Rules</Text>
                    </Pressable>
                    <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={() => setShowCreateChildForm(true)}>
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Add Child</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.childrenCardsGrid}>
                      {children.map((child) => {
                        const goalCount = savingsGoals.filter((g) => g.status === "active").length;
                        const pendingCount = pending.filter((p) => p.childId === child.id).length;
                        const spendingLimit = child.activeSpendingLimit ?? 0;
                        const balance = child.wallet?.balance ?? 0;
                        const progress = spendingLimit > 0 ? Math.min(100, Math.round((balance / spendingLimit) * 100)) : 0;

                        return (
                          <View key={child.id} style={styles.childrenCardV2}>
                            <View style={styles.childrenCardHeader}>
                              <View style={styles.childrenCardHeaderLeft}>
                                <View style={styles.childAvatar}>
                                  {resolveUploadImageUrl(child.profileImageUrl) ? (
                                    <Image source={{ uri: resolveUploadImageUrl(child.profileImageUrl)! }} style={styles.childAvatarImage} resizeMode="cover" />
                                  ) : (
                                    <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
                                  )}
                                </View>
                                <View>
                                  <Text style={styles.childName}>{child.nickname}</Text>
                                  <Text style={styles.childEmail}>Age {child.age}</Text>
                                </View>
                              </View>
                              <Text style={styles.childrenActivePill}>Active</Text>
                            </View>
                            <Text style={styles.childrenBalanceLabel}>Wallet Balance</Text>
                            <Text style={styles.childrenBalanceValue}>{formatMoney(balance)}</Text>
                            <View style={styles.progressTrack}>
                              <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                            </View>
                            <View style={styles.childrenMiniStats}>
                              <View style={styles.childrenMiniStat}>
                                <Text style={styles.childrenMiniStatLabel}>{`${(child.activeSpendingLimitPeriod ?? "monthly").charAt(0).toUpperCase()}${(child.activeSpendingLimitPeriod ?? "monthly").slice(1)} Limit`}</Text>
                                <Text style={styles.childrenMiniStatValue}>{formatMoney(spendingLimit)}</Text>
                              </View>
                              <View style={styles.childrenMiniStat}>
                                <Text style={styles.childrenMiniStatLabel}>Pending</Text>
                                <Text style={styles.childrenMiniStatValue}>{pendingCount}</Text>
                              </View>
                              <View style={styles.childrenMiniStat}>
                                <Text style={styles.childrenMiniStatLabel}>Goals</Text>
                                <Text style={styles.childrenMiniStatValue}>{goalCount}</Text>
                              </View>
                            </View>
                            <View style={styles.desktopChildActions}>
                              <Pressable style={styles.desktopSmallBtn} onPress={() => handleTabPress("children")}>
                                <Text style={styles.desktopSmallBtnText}>View Profile</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                onPress={() => openFundWalletForm(child.id)}
                              >
                                <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Fund Wallet</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    {children.length === 0 ? <Text style={styles.emptyText}>No child accounts yet.</Text> : null}

                    <View style={styles.childrenBottomPanels}>
                      <View style={styles.desktopPanel}>
                        <View style={styles.desktopPanelHeader}>
                          <Text style={styles.sectionTitle}>Recent Activity</Text>
                          <Pressable onPress={() => openTransactionsPage()}>
                            <Text style={styles.desktopPanelLink}>View all</Text>
                          </Pressable>
                        </View>
                        {allTransactions.slice(0, 4).map((tx) => (
                          <View key={tx.id} style={styles.desktopSimpleRow}>
                            <Text style={styles.listItemMain}>{tx.description ?? `${tx.type} transaction`}</Text>
                            <Text style={styles.listItemMeta}>
                              {tx.type === "earn" ? "+" : "-"} {formatMoney(tx.amount)}
                            </Text>
                          </View>
                        ))}
                        {allTransactions.length === 0 ? <Text style={styles.activityEmpty}>No activity yet.</Text> : null}
                      </View>

                      <View style={styles.desktopPanel}>
                        <View style={styles.desktopPanelHeader}>
                          <Text style={styles.sectionTitle}>Pending Approvals</Text>
                          <Pressable onPress={() => openTransactionsPage()}>
                            <Text style={styles.desktopPanelLink}>View all</Text>
                          </Pressable>
                        </View>
                        {pending.slice(0, 3).map((item) => (
                          <View key={item.id} style={styles.desktopPendingRow}>
                            <Text style={styles.desktopPendingCell}>{item.childName}</Text>
                            <Text style={styles.desktopPendingCell}>{formatMoney(item.amount)}</Text>
                            <View style={styles.desktopPendingActions}>
                              <Pressable style={[styles.decisionBtn, styles.approveBtn]} onPress={() => handleDecision(item.id, "approved")}>
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </Pressable>
                              <Pressable style={[styles.decisionBtn, styles.rejectBtn]} onPress={() => handleDecision(item.id, "rejected")}>
                                <Text style={styles.rejectBtnText}>Reject</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                        {pending.length === 0 ? <Text style={styles.activityEmpty}>No pending requests.</Text> : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Family Summary</Text>
                      <View style={styles.childrenSummaryGrid}>
                        <View style={styles.childrenSummaryItem}>
                          <Text style={styles.childrenSummaryValue}>{children.length}</Text>
                          <Text style={styles.childrenSummaryLabel}>Children</Text>
                        </View>
                        <View style={styles.childrenSummaryItem}>
                          <Text style={styles.childrenSummaryValue}>{formatMoney(totalChildBalance)}</Text>
                          <Text style={styles.childrenSummaryLabel}>Total Balance</Text>
                        </View>
                        <View style={styles.childrenSummaryItem}>
                          <Text style={styles.childrenSummaryValue}>{savingsGoals.filter((g) => g.status === "active").length}</Text>
                          <Text style={styles.childrenSummaryLabel}>Active Goals</Text>
                        </View>
                        <View style={styles.childrenSummaryItem}>
                          <Text style={styles.childrenSummaryValue}>{completedChores}</Text>
                          <Text style={styles.childrenSummaryLabel}>Completed Chores</Text>
                        </View>
                      </View>
                    </View>

                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.childrenTopActions, styles.mobileChildrenActions]}>
                  <Pressable style={styles.childrenTopBtn} onPress={() => openFundWalletForm()}>
                    <Text style={styles.childrenTopBtnText}>Fund Wallet</Text>
                  </Pressable>
                  <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={() => setShowCreateChildForm(true)}>
                    <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Add Child</Text>
                  </Pressable>
                </View>
                <View style={styles.childGrid}>
                  {children.map((child) => (
                  <View key={child.id} style={[styles.childCard, styles.childCardMobile, styles.mobileSurfaceCard]}>
                    <View style={styles.childCardLeft}>
                      <View style={styles.childAvatar}>
                        {resolveUploadImageUrl(child.profileImageUrl) ? (
                          <Image source={{ uri: resolveUploadImageUrl(child.profileImageUrl)! }} style={styles.childAvatarImage} resizeMode="cover" />
                        ) : (
                          <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.childCardRight}>
                      <Text style={styles.childName}>{child.nickname}</Text>
                      <Text style={styles.childEmail}>{child.email}</Text>
                      <View style={styles.childStat}>
                        <Text style={styles.childStatIcon}>🔥</Text>
                        <Text style={styles.childStatLabel}>Total Saved</Text>
                        <Text style={styles.childStatValue}>{formatMoney(child.wallet?.balance ?? 0)}</Text>
                      </View>
                      <View style={styles.childStat}>
                        <Text style={styles.childStatIcon}>💳</Text>
                        <Text style={styles.childStatLabel}>Spending Limit</Text>
                        <Text style={[styles.childStatValue, styles.childStatValueOrange]}>
                          {child.activeSpendingLimit ? formatMoney(child.activeSpendingLimit) : "Not set"}
                        </Text>
                      </View>
                      <Pressable
                        style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                        onPress={() => openFundWalletForm(child.id)}
                      >
                        <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Fund Wallet</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                  {children.length === 0 && <Text style={styles.emptyText}>No child accounts yet.</Text>}
                </View>
              </>
            )}

            {showCreateChildForm ? (
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, isMobile && styles.mobileSurfaceCard]}>
                  <View style={styles.modalHead}>
                    <Text style={styles.formCardTitle}>Create Child Account</Text>
                    <Pressable style={styles.modalCloseBtn} onPress={() => setShowCreateChildForm(false)}>
                      <Text style={styles.modalCloseText}>Close</Text>
                    </Pressable>
                  </View>
                  <View style={styles.childPhotoRow}>
                    <View style={styles.childPhotoPreview}>
                      {childProfileImageUrl ? (
                        <Image source={{ uri: childProfileImageUrl }} style={styles.childPhotoImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.childPhotoInitial}>+</Text>
                      )}
                    </View>
                    <View style={styles.childPhotoActions}>
                      <Text style={styles.childFormLabel}>Child Profile Picture</Text>
                      <AppButton
                        title={childProfileImageUrl ? "Change Picture" : "Choose Picture"}
                        variant="ghost"
                        onPress={handlePickChildProfileImage}
                      />
                    </View>
                  </View>
                  <AppInput label="Full Name" value={childFullName} onChangeText={setChildFullName} />
                  <AppInput label="Nickname" value={childNickname} onChangeText={setChildNickname} />
                  <AppInput label="Age (5-17)" value={childAge} onChangeText={setChildAge} keyboardType="numeric" />
                  <AppInput label="Email" value={childEmail} onChangeText={setChildEmail} keyboardType="email-address" />
                  <AppInput label="Password" value={childPassword} onChangeText={setChildPassword} secureTextEntry />
                  <Text style={[styles.passwordStrengthText, { color: childPasswordStrength.color }]}>Password strength: {childPasswordStrength.label}</Text>
                  <AppInput label="Confirm Password" value={childCreateConfirmPassword} onChangeText={setChildCreateConfirmPassword} secureTextEntry />
                  <AppButton title="Create Child" loading={submitting} onPress={handleCreateChild} />
                </View>
              </View>
            ) : null}

            {showFundForm ? (
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, isMobile && styles.mobileSurfaceCard]}>
                  <View style={styles.modalHead}>
                    <Text style={styles.formCardTitle}>Fund Child Account</Text>
                    <Pressable
                      style={styles.modalCloseBtn}
                      onPress={closeFundWalletForm}
                    >
                      <Text style={styles.modalCloseText}>Close</Text>
                    </Pressable>
                  </View>
                  {fundFormLockedChildId ? (
                    <View style={styles.dropdownWrap}>
                      <Text style={styles.childSelectorLabel}>Child</Text>
                      <View style={styles.dropdownButton}>
                        <Text style={styles.dropdownButtonText}>{children.find((c) => c.id === fundChildId)?.nickname ?? "Selected child"}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.dropdownWrap}>
                      <Text style={styles.childSelectorLabel}>Select Child</Text>
                      <Pressable style={styles.dropdownButton} onPress={() => setFundChildDropdownOpen((p) => !p)}>
                        <Text style={styles.dropdownButtonText}>
                          {children.find((c) => c.id === fundChildId)?.nickname ?? "Choose a child"}
                        </Text>
                        <Text style={styles.dropdownChevron}>{fundChildDropdownOpen ? "^" : "v"}</Text>
                      </Pressable>
                      {fundChildDropdownOpen ? (
                        <View style={styles.dropdownMenu}>
                          {children.length === 0 ? (
                            <Text style={styles.dropdownEmptyText}>No children found.</Text>
                          ) : (
                            children.map((child) => (
                              <Pressable
                                key={child.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setFundChildId(child.id);
                                  setFundChildDropdownOpen(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                              </Pressable>
                            ))
                          )}
                        </View>
                      ) : null}
                    </View>
                  )}
                  <AppInput label="Amount (UGX)" value={fundAmount} onChangeText={setFundAmount} keyboardType="numeric" />
                  <AppInput label="Reason" value={fundDescription} onChangeText={setFundDescription} />
                  <AppButton title="Send Funds" loading={submitting} onPress={handleFundChild} />
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* SAVINGS GOALS */}
        {!loading && tab === "goals" && (
          <View style={styles.section}>
            {showCreateGoalOnly ? (
              <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Create Savings Goal</Text>
                <View style={styles.dropdownWrap}>
                  <Text style={styles.childSelectorLabel}>Select Child</Text>
                  <Pressable style={styles.dropdownButton} onPress={() => setGoalsChildDropdownOpen((p) => !p)}>
                    <Text style={styles.dropdownButtonText}>
                      {children.find((c) => c.id === goalChildId)?.nickname ?? "Choose a child"}
                    </Text>
                    <Text style={styles.dropdownChevron}>{goalsChildDropdownOpen ? "▲" : "▼"}</Text>
                  </Pressable>
                  {goalsChildDropdownOpen ? (
                    <View style={styles.dropdownMenu}>
                      {children.length === 0 ? (
                        <Text style={styles.dropdownEmptyText}>No children found.</Text>
                      ) : (
                        children.map((child) => (
                          <Pressable
                            key={child.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setGoalChildId(child.id);
                              setGoalsChildDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
                <AppInput label="Goal Name (e.g. Bicycle, Books)" value={goalTitle} onChangeText={setGoalTitle} />
                <AppInput label="Target Amount (UGX)" value={goalTarget} onChangeText={setGoalTarget} keyboardType="numeric" />
                <AppDateInput label="Target Date (optional)" value={goalTargetDate} onChangeText={setGoalTargetDate} />
                <AppButton title="Create Goal" loading={submitting} onPress={handleCreateSavingsGoal} />
                <AppButton title="Back to Goals Overview" variant="ghost" onPress={() => setShowCreateGoalOnly(false)} />
              </View>
            ) : null}
            {showCreateGoalOnly ? null : (
            !isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Savings Goals</Text>
                    <Text style={styles.childrenSubtitle}>Track and manage your children's savings goals.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable style={styles.childrenTopBtn}>
                      <Text style={styles.childrenTopBtnText}>Goal History</Text>
                    </Pressable>
                    <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={handleOpenCreateGoal}>
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Create Goal</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Active Goals</Text>
                    <Text style={styles.desktopKpiValue}>{allChildGoals.filter((g) => g.status === "active").length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Saved</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(allChildGoals.reduce((sum, g) => sum + g.currentAmount, 0))}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Completed Goals</Text>
                    <Text style={styles.desktopKpiValue}>{allChildGoals.filter((g) => g.status === "completed").length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Goal Progress</Text>
                    <Text style={styles.desktopKpiValue}>{avgGoalProgress}%</Text>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <View style={styles.desktopPanelHeader}>
                        <Text style={styles.sectionTitle}>Goals by Child</Text>
                        <View style={styles.goalsFilterPill}>
                          <Text style={styles.childrenTopBtnText}>
                            {goalViewChildId === "all" ? "All Children" : children.find((c) => c.id === goalViewChildId)?.nickname ?? "Child"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.chipRow}>
                        <Pressable style={[styles.chip, goalViewChildId === "all" && styles.chipActive]} onPress={() => setGoalViewChildId("all")}>
                          <Text style={[styles.chipText, goalViewChildId === "all" && styles.chipTextActive]}>All</Text>
                        </Pressable>
                        {children.map((child) => (
                          <Pressable
                            key={child.id}
                            style={[styles.chip, goalViewChildId === child.id && styles.chipActive]}
                            onPress={() => setGoalViewChildId(child.id)}
                          >
                            <Text style={[styles.chipText, goalViewChildId === child.id && styles.chipTextActive]}>{child.nickname}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {completedGoalRows.map((goal) => {
                        const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                        return (
                          <View key={goal.id} style={styles.goalsRowCard}>
                            <View style={styles.goalsRowMain}>
                              <Text style={styles.listItemMain}>{goal.childName} - {goal.title}</Text>
                              <Text style={styles.listItemMeta}>{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}</Text>
                              <Text style={styles.listItemMeta}>
                                Completed on: {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : "N/A"}
                              </Text>
                              <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                              </View>
                            </View>
                            <View style={styles.goalsRowSide}>
                              <Text style={styles.goalPct}>{pct}%</Text>
                            </View>
                          </View>
                        );
                      })}
                      {completedGoalRows.length === 0 ? <Text style={styles.activityEmpty}>No completed goals found.</Text> : null}
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Goal Summary</Text>
                      <Text style={styles.childrenSummaryValue}>{avgGoalProgress}%</Text>
                      <Text style={styles.childrenSummaryLabel}>Average progress</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>On Track</Text><Text style={styles.listItemMain}>{goalsOnTrack}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Behind</Text><Text style={styles.listItemMain}>{goalsBehind}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Completed</Text><Text style={styles.listItemMain}>{allChildGoals.filter((g) => g.status === "completed").length}</Text></View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Popular Goal Ideas</Text>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Bicycle</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Laptop</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Smartphone</Text></View>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Savings Goals</Text>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Create Savings Goal</Text>
                  <View style={styles.dropdownWrap}>
                    <Text style={styles.childSelectorLabel}>Select Child</Text>
                    <Pressable style={styles.dropdownButton} onPress={() => setGoalsChildDropdownOpen((p) => !p)}>
                      <Text style={styles.dropdownButtonText}>
                        {children.find((c) => c.id === goalChildId)?.nickname ?? "Choose a child"}
                      </Text>
                      <Text style={styles.dropdownChevron}>{goalsChildDropdownOpen ? "▲" : "▼"}</Text>
                    </Pressable>
                    {goalsChildDropdownOpen ? (
                      <View style={styles.dropdownMenu}>
                        {children.length === 0 ? (
                          <Text style={styles.dropdownEmptyText}>No children found.</Text>
                        ) : (
                          children.map((child) => (
                            <Pressable key={child.id} style={styles.dropdownItem}
                              onPress={async () => {
                                setGoalChildId(child.id);
                                setGoalsChildDropdownOpen(false);
                                try {
                                  const g = await apiParentChildSavingsGoals(child.id);
                                  setSavingsGoals(g.goals);
                                } catch { /* ignore */ }
                              }}>
                              <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                  <AppInput label="Goal Name (e.g. Bicycle, Books)" value={goalTitle} onChangeText={setGoalTitle} />
                  <AppInput label="Target Amount (UGX)" value={goalTarget} onChangeText={setGoalTarget} keyboardType="numeric" />
                  <AppDateInput label="Target Date (optional)" value={goalTargetDate} onChangeText={setGoalTargetDate} />
                  <AppButton title="Create Goal" loading={submitting} onPress={handleCreateSavingsGoal} />
                </View>
              </>
            ))}
          </View>
        )}

        {/* TRANSACTIONS */}
        {!loading && tab === "transactions" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Transactions</Text>
                    <Text style={styles.childrenSubtitle}>
                      Your parent wallet activity and every transaction on your children&apos;s wallets (no row limit).
                    </Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable
                      style={styles.childrenTopBtn}
                      onPress={() => {
                        setPdfExportChildDropdownOpen(false);
                        setPdfExportTypeDropdownOpen(false);
                        setPdfExportStatusDropdownOpen(false);
                        setPdfExportColumnsDropdownOpen(false);
                        setShowTransactionPdfModal(true);
                      }}
                    >
                      <Text style={styles.childrenTopBtnText}>Export PDF…</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Deposits</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(totalDeposits)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Withdrawals</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(totalWithdrawals)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Pending Transactions</Text>
                    <Text style={styles.desktopKpiValue}>{pending.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Rewards Paid</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(rewardsPaid)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Transactions</Text>
                    <Text style={styles.desktopKpiValue}>{allTransactions.length}</Text>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.formCardTitle}>Transaction history</Text>

                      <View style={styles.transactionsTableHeader}>
                        <Text style={styles.transactionsHeadCell}>Date</Text>
                        <Text style={styles.transactionsHeadCell}>Account</Text>
                        <Text style={styles.transactionsHeadCell}>Type</Text>
                        <Text style={styles.transactionsHeadCell}>Description</Text>
                        <Text style={styles.transactionsHeadCell}>Amount</Text>
                        <Text style={styles.transactionsHeadCell}>Status</Text>
                      </View>

                      {allTransactions.map((item) => (
                        <View key={item.id} style={styles.transactionsRow}>
                          <Text style={styles.transactionsCell}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                          <Text style={styles.transactionsCell}>{item.childName}</Text>
                          <Text style={styles.transactionsCell}>{item.type}</Text>
                          <Text style={styles.transactionsCell}>{item.description ?? "No description"}</Text>
                          <Text style={[styles.transactionsCell, item.type === "earn" ? styles.mobileDeviceAmountPositive : styles.mobileDeviceAmountNegative]}>
                            {item.type === "earn" ? "+" : "-"} {formatMoney(item.amount)}
                          </Text>
                          <View style={[styles.txStatusPill, item.status === "approved" && styles.txApproved, item.status === "rejected" && styles.txRejected, item.status === "pending" && styles.txPending]}>
                            <Text style={styles.txStatusText}>{item.status}</Text>
                          </View>
                        </View>
                      ))}
                      {allTransactions.length === 0 ? <Text style={styles.activityEmpty}>No transactions yet.</Text> : null}
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Transaction Summary</Text>
                      <Text style={styles.childrenSummaryValue}>{allTransactions.length}</Text>
                      <Text style={styles.childrenSummaryLabel}>Total</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Deposits</Text><Text style={styles.listItemMain}>{approvedTransactions.filter((tx) => tx.type === "earn").length}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Withdrawals</Text><Text style={styles.listItemMain}>{approvedTransactions.filter((tx) => tx.type === "spend").length}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Rewards</Text><Text style={styles.listItemMain}>{approvedTransactions.filter((tx) => (tx.description ?? "").toLowerCase().includes("chore")).length}</Text></View>
                    </View>

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Recent Activity</Text>
                      {allTransactions.slice(0, 4).map((tx) => (
                        <View key={tx.id} style={styles.desktopSimpleRow}>
                          <Text style={styles.listItemMain}>{tx.childName}</Text>
                          <Text style={styles.listItemMeta}>{tx.description ?? tx.type}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.goalsTopBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>{mobileTransactionsView === "withdrawals" ? "Withdraw Requests" : "Transactions"}</Text>
                    <Text style={styles.childrenSubtitle}>
                      {mobileTransactionsView === "withdrawals" ? "Review child withdrawal requests and approve or reject them." : "Parent wallet and children&apos;s wallets."}
                    </Text>
                  </View>
                  {mobileTransactionsView === "all" ? (
                    <Pressable
                      style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]}
                      onPress={() => {
                        setPdfExportChildDropdownOpen(false);
                        setPdfExportTypeDropdownOpen(false);
                        setPdfExportStatusDropdownOpen(false);
                        setPdfExportColumnsDropdownOpen(false);
                        setShowTransactionPdfModal(true);
                      }}
                    >
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>Export PDF</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.childrenTopBtn} onPress={openTransactionsPage}>
                      <Text style={styles.childrenTopBtnText}>All Activity</Text>
                    </Pressable>
                  )}
                </View>

                {mobileTransactionsView === "withdrawals" ? (
                  pendingWithdrawalRequests.length === 0 ? (
                    <View style={[styles.activityCard, isMobile && styles.mobileSurfaceCard]}>
                      <Text style={styles.activityEmpty}>No withdrawal requests right now.</Text>
                    </View>
                  ) : (
                    <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                      {pendingWithdrawalRequests.map((item, idx) => (
                        <View
                          key={item.id}
                          style={[styles.txRow, styles.txRowMobile, idx < pendingWithdrawalRequests.length - 1 && styles.txRowBorder]}
                        >
                          <View style={[styles.txTypeBadge, styles.txSpendBadge]}>
                            <Text style={styles.txTypeBadgeText}>UGX</Text>
                          </View>
                          <View style={styles.txInfo}>
                            <Text style={styles.txMain}>{item.childName} wants {formatMoney(item.amount)}</Text>
                            <Text style={styles.txMeta}>{item.description ?? "Withdrawal request"}</Text>
                            <Text style={styles.txDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                            <View style={[styles.pendingActions, styles.pendingActionsMobile]}>
                              <Pressable style={[styles.decisionBtn, styles.approveBtn]} onPress={() => handleDecision(item.id, "approved")}>
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </Pressable>
                              <Pressable style={[styles.decisionBtn, styles.rejectBtn]} onPress={() => handleDecision(item.id, "rejected")}>
                                <Text style={styles.rejectBtnText}>Reject</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                ) : allTransactions.length === 0 ? (
                  <View style={[styles.activityCard, isMobile && styles.mobileSurfaceCard]}>
                    <Text style={styles.activityEmpty}>No transactions yet.</Text>
                  </View>
                ) : (
                  <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                    {allTransactions.map((item, idx) => (
                      <View key={item.id}
                        style={[styles.txRow, isMobile && styles.txRowMobile, idx < allTransactions.length - 1 && styles.txRowBorder]}>
                        <View style={[styles.txTypeBadge, item.type === "earn" ? styles.txEarnBadge : styles.txSpendBadge]}>
                          <Text style={styles.txTypeBadgeText}>{item.type === "earn" ? "+" : "-"}</Text>
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txMain}>
                            {item.childName} - {formatMoney(item.amount)}
                          </Text>
                          <Text style={styles.txMeta}>{item.description ?? "No description"}</Text>
                          <Text style={styles.txDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View style={[styles.txStatusPill,
                          item.status === "approved" && styles.txApproved,
                          item.status === "rejected" && styles.txRejected,
                          item.status === "pending" && styles.txPending,
                        ]}>
                          <Text style={styles.txStatusText}>{item.status}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ALLOWANCES */}
        {!loading && tab === "allowances" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Allowances</Text>
                    <Text style={styles.childrenSubtitle}>Manage scheduled allowances and payments for your children.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable
                      style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]}
                      onPress={() => handleOpenAllowanceForm()}
                    >
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Create Allowance</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Allowances</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(totalAllowancesValue)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Active Allowances</Text>
                    <Text style={styles.desktopKpiValue}>{activeAllowancesCount}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Paid This Month</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(paidThisMonth)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Upcoming Payments</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(upcomingPaymentsTotal)}</Text>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <View style={styles.desktopPanelHeader}>
                        <Text style={styles.sectionTitle}>Scheduled Allowances</Text>
                        <View style={styles.goalsFilterPill}>
                          <Text style={styles.childrenTopBtnText}>All Children</Text>
                        </View>
                      </View>
                      <View style={styles.allowancesScheduleGrid}>
                        {scheduledAllowances.slice(0, 3).map((allowance) => (
                          <View key={allowance.id} style={styles.allowanceCardV2}>
                            <View style={styles.desktopPanelHeader}>
                              <Text style={styles.listItemMain}>{allowance.childName}</Text>
                              <Text style={styles.childrenActivePill}>Active</Text>
                            </View>
                            <Text style={styles.childrenSummaryLabel}>{allowance.title}</Text>
                            <Text style={styles.childrenSummaryValue}>{formatMoney(allowance.amount)}</Text>
                            <Text style={styles.listItemMeta}>Next Payment: {formatAllowanceDateTime(allowance.availableOn)}</Text>
                            <View style={styles.desktopChildActions}>
                              <Pressable
                                style={styles.desktopSmallBtn}
                                onPress={() => {
                                  setEditingAllowanceId(null);
                                  setSelectedChildId(allowance.childId);
                                  setAllowanceTitle("");
                                  setAllowanceAmount("");
                                  setAllowanceDate("");
                                  setAllowanceTime("");
                                  setAllowanceNotes("");
                                  setAllowanceChildDropdownOpen(false);
                                  setShowAllowanceForm(true);
                                }}
                              >
                                <Text style={styles.desktopSmallBtnText}>View Details / New Schedule</Text>
                              </Pressable>
                              <Pressable
                                style={styles.desktopSmallBtn}
                                onPress={() => handleDeleteAllowance(allowance.id)}
                              >
                                <Text style={styles.desktopSmallBtnText}>Delete & Refund</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                      {scheduledAllowances.length === 0 ? <Text style={styles.activityEmpty}>No active allowances scheduled yet.</Text> : null}
                    </View>

                    <View style={styles.desktopPanel}>
                      <View style={styles.desktopPanelHeader}>
                        <Text style={styles.sectionTitle}>Recent Allowance Payments</Text>
                        <Pressable><Text style={styles.desktopPanelLink}>View all payments</Text></Pressable>
                      </View>
                      <View style={styles.transactionsTableHeader}>
                        <Text style={styles.transactionsHeadCell}>Date</Text>
                        <Text style={styles.transactionsHeadCell}>Child</Text>
                        <Text style={styles.transactionsHeadCell}>Amount</Text>
                        <Text style={styles.transactionsHeadCell}>Status</Text>
                      </View>
                      {allTransactions
                        .filter((tx) => (tx.description ?? "").toLowerCase().includes("allowance"))
                        .slice(0, 6)
                        .map((tx) => (
                          <View key={tx.id} style={styles.transactionsRow}>
                            <Text style={styles.transactionsCell}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                            <Text style={styles.transactionsCell}>{tx.childName}</Text>
                            <Text style={[styles.transactionsCell, styles.mobileDeviceAmountPositive]}>+ {formatMoney(tx.amount)}</Text>
                            <View style={[styles.txStatusPill, styles.txApproved]}>
                              <Text style={styles.txStatusText}>Paid</Text>
                            </View>
                          </View>
                        ))}
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Allowance Summary</Text>
                      <Text style={styles.childrenSummaryValue}>{formatMoney(paidThisMonth)}</Text>
                      <Text style={styles.childrenSummaryLabel}>Total paid this month</Text>
                      {allowances.slice(0, 3).map((item) => (
                        <View key={item.id} style={styles.goalsLegendItem}>
                          <Text style={styles.childrenSummaryLabel}>{item.childName}</Text>
                          <Text style={styles.listItemMain}>{formatMoney(item.amount)}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Upcoming Payments</Text>
                      {upcomingPayments.slice(0, 4).map((item) => (
                        <View key={item.id} style={styles.desktopSimpleRow}>
                          <Text style={styles.listItemMain}>{item.childName}</Text>
                          <Text style={styles.listItemMeta}>{item.title} - {formatAllowanceDateTime(item.availableOn)}</Text>
                        </View>
                      ))}
                      {upcomingPayments.length === 0 ? <Text style={styles.activityEmpty}>No upcoming payments in next 7 days.</Text> : null}
                    </View>
                  </View>
                </View>
              </>
            ) : null}

            {showAllowanceForm ? (
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, isMobile && styles.mobileSurfaceCard]}>
                  <View style={styles.modalHead}>
                    <Text style={styles.formCardTitle}>{editingAllowanceId ? "Allowance Details" : "Create Allowance"}</Text>
                    <Pressable
                      style={styles.modalCloseBtn}
                      onPress={() => {
                        setEditingAllowanceId(null);
                        setShowAllowanceForm(false);
                        setAllowanceChildDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.modalCloseText}>Close</Text>
                    </Pressable>
                  </View>
                  <View style={styles.dropdownWrap}>
                    <Text style={styles.childSelectorLabel}>Select Child</Text>
                    <Pressable
                      style={styles.dropdownButton}
                      onPress={() => setAllowanceChildDropdownOpen((prev) => !prev)}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {children.find((child) => child.id === selectedChildId)?.nickname ?? "Choose a child"}
                      </Text>
                      <Text style={styles.dropdownChevron}>{allowanceChildDropdownOpen ? "▲" : "▼"}</Text>
                    </Pressable>

                    {allowanceChildDropdownOpen ? (
                      <View style={styles.dropdownMenu}>
                        {children.length === 0 ? (
                          <Text style={styles.dropdownEmptyText}>No children found.</Text>
                        ) : (
                          children.map((child) => (
                            <Pressable
                              key={child.id}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setSelectedChildId(child.id);
                                setAllowanceChildDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                  <AppInput label="Title" value={allowanceTitle} onChangeText={setAllowanceTitle} />
                  <AppInput label="Amount (UGX)" value={allowanceAmount} onChangeText={setAllowanceAmount} keyboardType="numeric" />
                  <AppDateInput label="Available On" value={allowanceDate} onChangeText={setAllowanceDate} />
                  <AppTimeInput label="Time" value={allowanceTime} onChangeText={setAllowanceTime} />
                  <AppInput label="Notes" value={allowanceNotes} onChangeText={setAllowanceNotes} multiline numberOfLines={3} />
                  <AppButton
                    title={editingAllowanceId ? "Save Changes" : "Create Allowance"}
                    loading={submitting}
                    onPress={editingAllowanceId ? handleUpdateAllowance : handleCreateAllowance}
                  />
                  {editingAllowanceId ? (
                    <AppButton
                      title="Delete & Refund"
                      loading={submitting}
                      onPress={async () => {
                        await handleDeleteAllowance(editingAllowanceId);
                        setEditingAllowanceId(null);
                        setShowAllowanceForm(false);
                        setAllowanceChildDropdownOpen(false);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* CHORES */}
        {!loading && tab === "chores" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Chores</Text>
                    <Text style={styles.childrenSubtitle}>Assign tasks, track progress, and manage rewards for your children.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable style={styles.childrenTopBtn}>
                      <Text style={styles.childrenTopBtnText}>Chore History</Text>
                    </Pressable>
                    <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={() => setShowAssignChoreForm((p) => !p)}>
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Assign Chore</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Chores</Text>
                    <Text style={styles.desktopKpiValue}>{chores.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Pending Approval</Text>
                    <Text style={styles.desktopKpiValue}>{pendingChoresCount}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Completed</Text>
                    <Text style={styles.desktopKpiValue}>{completedChores}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Rewards Paid</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(rewardsPaid)}</Text>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <View style={styles.desktopPanelHeader}>
                        <Text style={styles.sectionTitle}>Chores by Child</Text>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>All Children</Text></View>
                      </View>
                      <View style={styles.allowancesScheduleGrid}>
                        {children.map((child) => {
                          const childChores = chores.filter((c) => c.childId === child.id);
                          const childPending = childChores.filter((c) => c.status === "assigned").length;
                          const childCompleted = childChores.filter((c) => c.status === "completed").length;
                          const childRewards = approvedTransactions
                            .filter((tx) => tx.childId === child.id && (tx.description ?? "").toLowerCase().includes("chore"))
                            .reduce((sum, tx) => sum + tx.amount, 0);
                          return (
                            <View key={child.id} style={styles.allowanceCardV2}>
                              <View style={styles.desktopPanelHeader}>
                                <Text style={styles.listItemMain}>{child.nickname} (Age {child.age})</Text>
                                <Pressable style={styles.desktopSmallBtn} onPress={() => handleOpenAssignChoreForm(child.id)}>
                                  <Text style={styles.desktopSmallBtnText}>Assign Chore</Text>
                                </Pressable>
                              </View>
                              <View style={styles.childrenMiniStats}>
                                <View style={styles.childrenMiniStat}>
                                  <Text style={styles.childrenMiniStatLabel}>Pending</Text>
                                  <Text style={styles.childrenMiniStatValue}>{childPending}</Text>
                                </View>
                                <View style={styles.childrenMiniStat}>
                                  <Text style={styles.childrenMiniStatLabel}>Completed</Text>
                                  <Text style={styles.childrenMiniStatValue}>{childCompleted}</Text>
                                </View>
                                <View style={styles.childrenMiniStat}>
                                  <Text style={styles.childrenMiniStatLabel}>Approved</Text>
                                  <Text style={styles.childrenMiniStatValue}>{approvedRewardCount}</Text>
                                </View>
                                <View style={styles.childrenMiniStat}>
                                  <Text style={styles.childrenMiniStatLabel}>Total Rewards</Text>
                                  <Text style={styles.childrenMiniStatValue}>{formatMoney(childRewards)}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>All Chores</Text>
                      <View style={styles.transactionsTableHeader}>
                        <Text style={styles.transactionsHeadCell}>Chore</Text>
                        <Text style={styles.transactionsHeadCell}>Child</Text>
                        <Text style={styles.transactionsHeadCell}>Due Date</Text>
                        <Text style={styles.transactionsHeadCell}>Status</Text>
                        <Text style={styles.transactionsHeadCell}>Actions</Text>
                      </View>
                      {chores.map((chore) => (
                        <View key={chore.id} style={styles.transactionsRow}>
                          <Text style={styles.transactionsCell}>{chore.title}</Text>
                          <Text style={styles.transactionsCell}>{chore.childName}</Text>
                          <Text style={styles.transactionsCell}>{chore.dueDate ? new Date(chore.dueDate).toLocaleDateString() : "No due date"}</Text>
                          <View style={[styles.txStatusPill, chore.status === "completed" ? styles.txApproved : styles.txPending]}>
                            <Text style={styles.txStatusText}>{chore.status === "completed" ? "Completed" : "Pending"}</Text>
                          </View>
                          <View style={styles.desktopPendingActions}>
                            <Pressable
                              style={styles.desktopSmallBtn}
                              onPress={() => setSelectedChoreForDetails(chore)}
                            >
                              <Text style={styles.desktopSmallBtnText}>View</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      {chores.length === 0 ? <Text style={styles.activityEmpty}>No chores yet.</Text> : null}
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    {selectedChoreForDetails ? (
                      <View style={styles.desktopPanel}>
                        <View style={styles.desktopPanelHeader}>
                          <Text style={styles.sectionTitle}>Chore Details</Text>
                          <Pressable style={styles.desktopSmallBtn} onPress={() => setSelectedChoreForDetails(null)}>
                            <Text style={styles.desktopSmallBtnText}>Close</Text>
                          </Pressable>
                        </View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Chore</Text><Text style={styles.listItemMain}>{selectedChoreForDetails.title}</Text></View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Child</Text><Text style={styles.listItemMain}>{selectedChoreForDetails.childName}</Text></View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Deadline</Text><Text style={styles.listItemMain}>{selectedChoreDeadlineLabel}</Text></View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Completed At</Text><Text style={styles.listItemMain}>{selectedChoreCompletionLabel}</Text></View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Deadline Status</Text><Text style={styles.listItemMain}>{selectedChoreDeadlineStatus}</Text></View>
                      </View>
                    ) : null}
                    {showAssignChoreForm ? (
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Assign Chore</Text>
                        <View style={styles.dropdownWrap}>
                          <Text style={styles.childSelectorLabel}>Select Child</Text>
                          <Pressable
                            style={styles.dropdownButton}
                            onPress={() => setChoreChildDropdownOpen((prev) => !prev)}
                          >
                            <Text style={styles.dropdownButtonText}>
                              {children.find((child) => child.id === selectedChildId)?.nickname ?? "Choose a child"}
                            </Text>
                            <Text style={styles.dropdownChevron}>{choreChildDropdownOpen ? "▲" : "▼"}</Text>
                          </Pressable>
                          {choreChildDropdownOpen ? (
                            <View style={styles.dropdownMenu}>
                              {children.length === 0 ? (
                                <Text style={styles.dropdownEmptyText}>No children found.</Text>
                              ) : (
                                children.map((child) => (
                                  <Pressable
                                    key={child.id}
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                      setSelectedChildId(child.id);
                                      setChoreChildDropdownOpen(false);
                                    }}
                                  >
                                    <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                                  </Pressable>
                                ))
                              )}
                            </View>
                          ) : null}
                        </View>
                        <AppInput label="Title" value={choreTitle} onChangeText={setChoreTitle} />
                        <AppInput label="Description" value={choreDescription} onChangeText={setChoreDescription} multiline numberOfLines={3} />
                        <AppInput label="Reward Amount (UGX)" value={choreRewardAmount} onChangeText={setChoreRewardAmount} keyboardType="numeric" />
                        <AppDateInput label="Due Date" value={choreDueDate} onChangeText={setChoreDueDate} />
                        <AppButton title="Assign Chore" loading={submitting} onPress={handleCreateChore} />
                      </View>
                    ) : null}
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Pending Approvals</Text>
                      {chores.filter((c) => c.status === "assigned").slice(0, 4).map((c) => (
                        <View key={c.id} style={styles.desktopSimpleRow}>
                          <Text style={styles.listItemMain}>{c.title}</Text>
                          <Text style={styles.listItemMeta}>{c.childName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                <Text style={styles.formCardTitle}>Assign Chore</Text>
                <View style={styles.dropdownWrap}>
                  <Text style={styles.childSelectorLabel}>Select Child</Text>
                  <Pressable
                    style={styles.dropdownButton}
                    onPress={() => setChoreChildDropdownOpen((prev) => !prev)}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {children.find((child) => child.id === selectedChildId)?.nickname ?? "Choose a child"}
                    </Text>
                    <Text style={styles.dropdownChevron}>{choreChildDropdownOpen ? "▲" : "▼"}</Text>
                  </Pressable>
                  {choreChildDropdownOpen ? (
                    <View style={styles.dropdownMenu}>
                      {children.length === 0 ? (
                        <Text style={styles.dropdownEmptyText}>No children found.</Text>
                      ) : (
                        children.map((child) => (
                          <Pressable
                            key={child.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelectedChildId(child.id);
                              setChoreChildDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
                <AppInput label="Title" value={choreTitle} onChangeText={setChoreTitle} />
                <AppInput label="Description" value={choreDescription} onChangeText={setChoreDescription} multiline numberOfLines={3} />
                <AppInput label="Reward Amount (UGX)" value={choreRewardAmount} onChangeText={setChoreRewardAmount} keyboardType="numeric" />
                <AppDateInput label="Due Date (optional)" value={choreDueDate} onChangeText={setChoreDueDate} />
                <AppButton title="Assign Chore" loading={submitting} onPress={handleCreateChore} />
              </View>
            )}
          </View>
        )}

        {/* LEARNING CONTENT */}
        {!loading && tab === "learning" && (
          <View style={styles.section}>
            <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Learning Content</Text>
            <Text style={styles.learningSubtitle}>
              Age-appropriate financial education modules for your children.
            </Text>

            <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.formCardTitle}>Assign To Child</Text>
              <ChildSelector children={children} selectedId={selectedChildId} onSelect={setSelectedChildId} />
              <AppDateInput label="Study Start Date" value={learningStudyStartDate} onChangeText={setLearningStudyStartDate} />
              <AppDateInput label="Study End Date" value={learningStudyEndDate} onChangeText={setLearningStudyEndDate} />
            </View>

            <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.formCardTitle}>Lesson Progress</Text>
              {learningAssignments.length > 0 ? (
                learningAssignments.map((assignment) => (
                  <View key={assignment.assignmentId} style={styles.progressItem}>
                    <View style={styles.progressItemHeader}>
                      <Text style={styles.progressItemLabel}>{assignment.childName} • {assignment.lessonTitle}</Text>
                      <Text style={styles.progressItemPct}>{assignment.progressPercent}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${assignment.progressPercent}%` as any }]} />
                    </View>
                    <Text style={styles.listItemMeta}>
                      {assignment.status === "completed" ? "Finished" : assignment.progressPercent > 0 ? "In progress" : "Not started"}
                      {assignment.lastViewedAt ? ` • Last viewed ${new Date(assignment.lastViewedAt).toLocaleDateString()}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.listItemMeta}>Assigned lessons will show reading and video progress here.</Text>
              )}
            </View>

            {lessons.length > 0 ? (
              lessons.filter((l) => l.isPublished).map((lesson) => (
                <View key={lesson.id} style={[styles.lessonCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonContent} numberOfLines={4}>{lesson.content}</Text>
                  {lesson.resourceUrl ? (
                    <Text style={styles.listItemMeta}>
                      {lesson.resourceType.toUpperCase()} material: {lesson.fileName ?? lesson.resourceUrl}
                    </Text>
                  ) : null}
                  {lesson.resourceUrl ? (
                    <View style={styles.desktopChildActions}>
                      <Pressable style={styles.desktopSmallBtn} onPress={() => openLessonResource(lesson.resourceUrl!)}>
                        <Text style={styles.desktopSmallBtnText}>View</Text>
                      </Pressable>
                      <Pressable style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]} onPress={() => openLessonResource(lesson.resourceUrl!)}>
                        <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Download</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <AppButton
                    title="Assign To Selected Child"
                    loading={submitting}
                    onPress={() => handleAssignLearningLesson(lesson.id)}
                  />
                </View>
              ))
            ) : null}
          </View>
        )}

        {/* SPENDING LIMITS */}
        {!loading && tab === "limits" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Spending Limits</Text>
                    <Text style={styles.childrenSubtitle}>Set and monitor child spending caps across accounts and schedules.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable style={styles.childrenTopBtn}>
                      <Text style={styles.childrenTopBtnText}>Limit History</Text>
                    </Pressable>
                    <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={() => handleOpenLimitForm()}>
                      <Text style={[styles.childrenTopBtnText, styles.childrenTopBtnTextPrimary]}>+ Set Limit</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Children With Limits</Text>
                    <Text style={styles.desktopKpiValue}>{children.filter((c) => c.activeSpendingLimit).length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Average Limit</Text>
                    <Text style={styles.desktopKpiValue}>
                      {formatMoney(
                        children.filter((c) => c.activeSpendingLimit).length > 0
                          ? Math.round(
                              children.reduce((sum, c) => sum + (c.activeSpendingLimit ?? 0), 0) /
                                children.filter((c) => c.activeSpendingLimit).length
                            )
                          : 0
                      )}
                    </Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Total Family Limit</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(children.reduce((sum, c) => sum + (c.activeSpendingLimit ?? 0), 0))}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>No Limit Set</Text>
                    <Text style={styles.desktopKpiValue}>{children.filter((c) => !c.activeSpendingLimit).length}</Text>
                  </View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <View style={styles.desktopPanelHeader}>
                        <Text style={styles.sectionTitle}>Limit by Child</Text>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>All Children</Text></View>
                      </View>
                      <View style={styles.allowancesScheduleGrid}>
                        {children.map((child) => {
                          const limit = child.activeSpendingLimit ?? 0;
                          const spend = child.wallet?.totalSpent ?? 0;
                          const usedPct = limit > 0 ? Math.min(100, Math.round((spend / limit) * 100)) : 0;
                          return (
                            <View key={child.id} style={styles.allowanceCardV2}>
                              <View style={styles.desktopPanelHeader}>
                                <Text style={styles.listItemMain}>{child.nickname}</Text>
                                <Text style={styles.childrenSummaryLabel}>Age {child.age}</Text>
                              </View>
                              <Text style={styles.childrenSummaryLabel}>
                                {(child.activeSpendingLimitPeriod ?? "monthly").charAt(0).toUpperCase() +
                                  (child.activeSpendingLimitPeriod ?? "monthly").slice(1)}{" "}
                                Limit
                              </Text>
                              <Text style={styles.childrenSummaryValue}>{formatMoney(limit)}</Text>
                              <Text style={styles.listItemMeta}>Spent this {child.activeSpendingLimitPeriod ?? "period"}: {formatMoney(spend)}</Text>
                              <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${usedPct}%` as any }]} />
                              </View>
                              <View style={styles.desktopChildActions}>
                                <Pressable
                                  style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                  onPress={() => {
                                    setLimitAmount(limit > 0 ? String(limit) : "");
                                    if (child.activeSpendingLimitPeriod && child.activeSpendingLimitPeriod !== "quarterly") setLimitPeriodType(child.activeSpendingLimitPeriod);
                                    else setLimitPeriodType("monthly");
                                    handleOpenLimitForm(child.id);
                                  }}
                                >
                                  <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Edit Limit</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Limit Alerts</Text>
                      {children.slice(0, 4).map((child) => {
                        const limit = child.activeSpendingLimit ?? 0;
                        const spent = child.wallet?.totalSpent ?? 0;
                        const ratio = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                        return (
                          <View key={child.id} style={styles.desktopSimpleRow}>
                            <Text style={styles.listItemMain}>{child.nickname}</Text>
                            <Text style={styles.listItemMeta}>{limit > 0 ? `${ratio}% of limit used` : "No limit set"}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Spending Limits</Text>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Set daily, weekly, or monthly withdrawal limits for each child.</Text>
                  <AppButton title="Set Limit" onPress={() => handleOpenLimitForm()} />
                </View>
                {children.map((child) => (
                  <View key={child.id} style={[styles.activityCard, styles.mobileSurfaceCard]}>
                    <Text style={styles.listItemMain}>{child.nickname}</Text>
                    <Text style={styles.listItemMeta}>
                      {(child.activeSpendingLimitPeriod ?? "monthly").charAt(0).toUpperCase() +
                        (child.activeSpendingLimitPeriod ?? "monthly").slice(1)}{" "}
                      limit: {child.activeSpendingLimit ? formatMoney(child.activeSpendingLimit) : "Not set"}
                    </Text>
                    <Pressable
                      style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                      onPress={() => {
                        setLimitAmount(child.activeSpendingLimit ? String(child.activeSpendingLimit) : "");
                        if (child.activeSpendingLimitPeriod && child.activeSpendingLimitPeriod !== "quarterly") setLimitPeriodType(child.activeSpendingLimitPeriod);
                        else setLimitPeriodType("monthly");
                        handleOpenLimitForm(child.id);
                      }}
                    >
                      <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Edit Limit</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {showLimitForm ? (
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, isMobile && styles.mobileSurfaceCard]}>
                  <View style={styles.modalHead}>
                    <Text style={styles.formCardTitle}>Set Spending Limit</Text>
                    <Pressable
                      style={styles.modalCloseBtn}
                      onPress={closeLimitForm}
                    >
                      <Text style={styles.modalCloseText}>Close</Text>
                    </Pressable>
                  </View>
                  {limitFormLockedChildId ? (
                    <View style={styles.dropdownWrap}>
                      <Text style={styles.childSelectorLabel}>Child</Text>
                      <View style={styles.dropdownButton}>
                        <Text style={styles.dropdownButtonText}>{children.find((c) => c.id === limitFormLockedChildId)?.nickname ?? "Selected child"}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.dropdownWrap}>
                      <Text style={styles.childSelectorLabel}>Select Child</Text>
                      <Pressable style={styles.dropdownButton} onPress={() => setLimitsChildDropdownOpen((p) => !p)}>
                        <Text style={styles.dropdownButtonText}>
                          {children.find((c) => c.id === selectedChildId)?.nickname ?? "Choose a child"}
                        </Text>
                        <Text style={styles.dropdownChevron}>{limitsChildDropdownOpen ? "^" : "v"}</Text>
                      </Pressable>
                      {limitsChildDropdownOpen ? (
                        <View style={styles.dropdownMenu}>
                          {children.length === 0 ? (
                            <Text style={styles.dropdownEmptyText}>No children found.</Text>
                          ) : (
                            children.map((child) => (
                              <Pressable
                                key={child.id}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setSelectedChildId(child.id);
                                  setLimitsChildDropdownOpen(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                              </Pressable>
                            ))
                          )}
                        </View>
                      ) : null}
                    </View>
                  )}
                  <AppInput label="Limit Amount (UGX)" value={limitAmount} onChangeText={setLimitAmount} keyboardType="numeric" />
                  <View style={styles.toggleRowGroup}>
                    {(["daily", "weekly", "monthly"] as const).map((period) => (
                      <Pressable
                        key={period}
                        style={[styles.chipBtn, limitPeriodType === period && styles.chipBtnActive]}
                        onPress={() => setLimitPeriodType(period)}
                      >
                        <Text style={[styles.chipBtnText, limitPeriodType === period && styles.chipBtnTextActive]}>
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <AppButton title="Update Limit" loading={submitting} onPress={handleSetLimit} />
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* NOTIFICATIONS */}
        {!loading && tab === "notifications" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Notifications</Text>
                    <Text style={styles.childrenSubtitle}>Stay updated with important alerts and activities.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable style={styles.childrenTopBtn} onPress={handleMarkAllNotificationsRead}>
                      <Text style={styles.childrenTopBtnText}>Mark all as read</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      {notifications.length === 0 ? (
                        <Text style={styles.activityEmpty}>No alerts yet.</Text>
                      ) : (
                        notifications.slice(0, 12).map((item) => (
                          <Pressable
                            key={item.id}
                            style={[styles.notificationRow, !item.isRead && styles.notificationRowUnread]}
                            onPress={() => {
                              if (!item.isRead) void handleMarkNotificationRead(item.id);
                            }}
                          >
                            <View style={[styles.notificationDot, item.isRead && styles.notificationDotRead]} />
                            <View style={styles.notificationContent}>
                              <Text style={styles.listItemMain}>{item.message}</Text>
                              <Text style={styles.listItemMeta}>{item.type.replace(/_/g, " ")}</Text>
                            </View>
                            <Text style={styles.listItemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Unread Summary</Text>
                      <Text style={styles.childrenSummaryValue}>{unreadNotificationCount}</Text>
                      <Text style={styles.childrenSummaryLabel}>Unread notifications</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Notifications</Text>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Unread notifications: {unreadNotificationCount}</Text>
                  <AppButton title="Mark all as read" loading={submitting} onPress={handleMarkAllNotificationsRead} />
                </View>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  {notifications.length === 0 ? (
                    <Text style={styles.activityEmpty}>No alerts yet.</Text>
                  ) : (
                    notifications.slice(0, 12).map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.notificationRow, !item.isRead && styles.notificationRowUnread]}
                        onPress={() => {
                          if (!item.isRead) void handleMarkNotificationRead(item.id);
                        }}
                      >
                        <View style={[styles.notificationDot, item.isRead && styles.notificationDotRead]} />
                        <View style={styles.notificationContent}>
                          <Text style={styles.listItemMain}>{item.message}</Text>
                          <Text style={styles.listItemMeta}>{item.type.replace(/_/g, " ")}</Text>
                        </View>
                        <Text style={styles.listItemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        )}

        {/* REPORTS */}
        {!loading && tab === "reports" && (
          <View style={styles.section}>
            <View style={[styles.goalsTopBar, isMobile && styles.reportsTopBarMobile]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Reports</Text>
                <Text style={styles.childrenSubtitle}>
                  The figures on these cards are for this month only. For a PDF, you choose the time range and what to include.
                </Text>
              </View>
            </View>

            <View style={styles.reportsGrid}>
              {/* 1. Transaction history */}
              <View style={[styles.reportCard, isMobile && styles.reportCardMobile]}>
                <Text style={styles.reportCardKicker}>1</Text>
                <Text style={styles.reportCardTitle}>Transaction history</Text>
                <Text style={styles.reportCardDesc}>Every child-wallet movement in the period you choose (types, status, amounts).</Text>
                <View style={styles.reportCardStats}>
                  <Text style={styles.reportCardStatLine}>
                    {reportSummary.children.approvedCount} approved · {reportSummary.children.pendingCount} pending
                  </Text>
                </View>
                <Pressable style={[styles.reportCardBtn, styles.reportCardBtnPrimary]} onPress={() => openReportPdfModal("transactions")}>
                  <Text style={[styles.reportCardBtnText, styles.reportCardBtnTextPrimary]}>Download PDF</Text>
                </Pressable>
              </View>

              {/* 2. Spending summary */}
              <View style={[styles.reportCard, isMobile && styles.reportCardMobile]}>
                <Text style={styles.reportCardKicker}>2</Text>
                <Text style={styles.reportCardTitle}>Spending summary</Text>
                <Text style={styles.reportCardDesc}>Per-child balances and earn/spend totals for the period you choose.</Text>
                <View style={styles.reportCardStats}>
                  <Text style={styles.reportCardStatLine}>Total spent (this month): {formatMoney(reportSummary.children.totalSpent)}</Text>
                  <Text style={styles.reportCardStatLine}>Total earned (this month): {formatMoney(reportSummary.children.totalEarned)}</Text>
                </View>
                <Pressable style={[styles.reportCardBtn, styles.reportCardBtnPrimary]} onPress={() => openReportPdfModal("children-overview")}>
                  <Text style={[styles.reportCardBtnText, styles.reportCardBtnTextPrimary]}>Download PDF</Text>
                </Pressable>
              </View>

              {/* 3. Pending requests */}
              <View style={[styles.reportCard, isMobile && styles.reportCardMobile]}>
                <Text style={styles.reportCardKicker}>3</Text>
                <Text style={styles.reportCardTitle}>Pending requests</Text>
                <Text style={styles.reportCardDesc}>Spend and withdrawal requests waiting for your approval.</Text>
                <View style={styles.reportCardStats}>
                  <Text style={styles.reportCardStatLine}>{pending.length} pending</Text>
                  {pending.slice(0, 4).map((p) => (
                    <Text key={p.id} style={styles.reportCardPendingLine}>
                      {p.childName} · {p.type} · {formatMoney(p.amount)}
                    </Text>
                  ))}
                  {pending.length === 0 ? <Text style={styles.reportCardMuted}>No pending requests.</Text> : null}
                </View>
                <View style={styles.reportCardActionsRow}>
                  <Pressable style={[styles.reportCardBtn, styles.reportCardBtnPrimary, styles.reportCardBtnFlex]} onPress={() => openReportPdfModal("pending")}>
                    <Text style={[styles.reportCardBtnText, styles.reportCardBtnTextPrimary]}>Download PDF</Text>
                  </Pressable>
                  <Pressable style={[styles.reportCardBtn, styles.reportCardBtnFlex]} onPress={() => openTransactionsPage()}>
                    <Text style={styles.reportCardBtnText}>Review</Text>
                  </Pressable>
                </View>
              </View>

              {/* 4. Monthly report */}
              <View style={[styles.reportCard, isMobile && styles.reportCardMobile]}>
                <Text style={styles.reportCardKicker}>4</Text>
                <Text style={styles.reportCardTitle}>Monthly report</Text>
                <Text style={styles.reportCardDesc}>
                  Combined PDF snapshot: summary totals, per-child overview, and recent transactions (choose sections in the export dialog).
                </Text>
                <View style={styles.reportCardStats}>
                  <Text style={styles.reportCardStatLine}>Same month as the numbers on the other cards.</Text>
                </View>
                <Pressable style={[styles.reportCardBtn, styles.reportCardBtnPrimary]} onPress={() => openReportPdfModal("full-export")}>
                  <Text style={[styles.reportCardBtnText, styles.reportCardBtnTextPrimary]}>Download PDF</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* SUPPORT */}
        {!loading && tab === "support" && (
          <View style={styles.section}>
            <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Support & Disputes</Text>
            <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.formCardTitle}>Raise an Issue</Text>
              <AppInput
                label="Issue type"
                value={supportIssueType}
                onChangeText={setSupportIssueType}
                placeholder="Failed approval"
              />
              <AppInput
                label="Issue details"
                value={supportMessage}
                onChangeText={setSupportMessage}
                placeholder="Describe what happened..."
                multiline
                numberOfLines={4}
              />
              <AppButton
                title="Submit Support Request"
                loading={submitting}
                onPress={handleCreateSupportTicket}
              />
              <Text style={styles.helperText}>
                Common help: failed OTP/approval, incorrect balance, suspicious transaction, login problem.
              </Text>
            </View>
            <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.formCardTitle}>My Support Tickets</Text>
              {supportTickets.length === 0 ? (
                <Text style={styles.activityEmpty}>No support tickets submitted yet.</Text>
              ) : (
                supportTickets.slice(0, 10).map((ticket) => (
                  <View key={ticket.id} style={styles.listItem}>
                    <Text style={styles.listItemMain}>{ticket.issueType}</Text>
                    <Text style={styles.listItemMeta}>{ticket.message}</Text>
                    <Text style={styles.listItemMeta}>
                      Status: {ticket.status} - {new Date(ticket.createdAt).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* SETTINGS */}
        {!loading && tab === "settings" && (
          <View style={styles.section}>
            <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Settings</Text>
            <Text style={styles.childrenSubtitle}>Manage account details, child passwords, and account access.</Text>

            <View style={[styles.settingsSectionCard, isMobile && styles.mobileSurfaceCard]}>
              <View>
                <Text style={styles.sectionTitle}>Account Settings</Text>
                <Text style={styles.listItemMeta}>Saved parent account details</Text>
              </View>
              <View style={styles.settingsInfoGrid}>
                <View style={styles.settingsInfoRow}>
                  <Text style={styles.settingsInfoLabel}>Full name</Text>
                  <Text style={styles.settingsInfoValue}>{accountDisplayName}</Text>
                </View>
                <View style={styles.settingsInfoRow}>
                  <Text style={styles.settingsInfoLabel}>Phone number</Text>
                  <Text style={styles.settingsInfoValue}>{accountDisplayPhone}</Text>
                </View>
                <View style={styles.settingsInfoRow}>
                  <Text style={styles.settingsInfoLabel}>Email</Text>
                  <Text style={styles.settingsInfoValue}>{accountDisplayEmail}</Text>
                </View>
                <View style={styles.settingsInfoRow}>
                  <Text style={styles.settingsInfoLabel}>NIN</Text>
                  <Text style={styles.settingsInfoValue}>{accountDisplayNin}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.settingsSectionCard, isMobile && styles.mobileSurfaceCard]}>
              <View style={[styles.settingsTwoCol, isMobile && styles.settingsTwoColMobile]}>
                <View style={styles.settingsPrimaryCol}>
                  <Text style={styles.sectionTitle}>Child Password</Text>
                  <Text style={styles.listItemMeta}>Choose a child account and set a new password for them.</Text>
                  <ChildSelector children={children} selectedId={passwordChildId} onSelect={setPasswordChildId} />
                  <AppInput
                    label="New Child Password"
                    value={childNewPassword}
                    onChangeText={setChildNewPassword}
                    secureTextEntry
                  />
                  <AppInput
                    label="Confirm Child Password"
                    value={childConfirmPassword}
                    onChangeText={setChildConfirmPassword}
                    secureTextEntry
                  />
                  <AppButton title="Update Child Password" loading={submitting} onPress={handleChangeChildPassword} />
                </View>
                <View style={styles.settingsRulesCard}>
                  <Text style={styles.settingsRulesTitle}>Rules for child passwords</Text>
                  <Text style={styles.settingsRulesText}>Use at least 8 characters.</Text>
                  <Text style={styles.settingsRulesText}>Use a password the child has not used elsewhere.</Text>
                  <Text style={styles.settingsRulesText}>Avoid names, birthdays, or easy patterns.</Text>
                </View>
              </View>
            </View>

            <View style={[styles.settingsSectionCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.sectionTitle}>Child Account Access</Text>
              <Text style={styles.listItemMeta}>Select a child above, then deactivate or delete that child account.</Text>
              <View style={styles.settingsActionRow}>
                <Pressable style={[styles.settingsActionBtn, styles.settingsWarningBtn]} onPress={handleDeactivateSelectedChild} disabled={submitting}>
                  <Text style={styles.settingsWarningText}>Deactivate Child Account</Text>
                </Pressable>
                <Pressable style={[styles.settingsActionBtn, styles.settingsDangerBtn]} onPress={handleDeleteSelectedChild} disabled={submitting}>
                  <Text style={styles.settingsDangerText}>Delete Child Account</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.settingsSectionCard, styles.settingsDangerCard, isMobile && styles.mobileSurfaceCard]}>
              <Text style={styles.sectionTitle}>Parent Account Access</Text>
              <Text style={styles.listItemMeta}>Deactivate blocks future sign-ins. Delete permanently removes the parent account and linked child accounts.</Text>
              <View style={styles.settingsActionRow}>
                <Pressable style={[styles.settingsActionBtn, styles.settingsWarningBtn]} onPress={handleDeactivateParentAccount} disabled={submitting}>
                  <Text style={styles.settingsWarningText}>Deactivate Parent Account</Text>
                </Pressable>
                <Pressable style={[styles.settingsActionBtn, styles.settingsDangerBtn]} onPress={handleDeleteParentAccount} disabled={submitting}>
                  <Text style={styles.settingsDangerText}>Delete Parent Account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showTransactionPdfModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setPdfExportChildDropdownOpen(false);
          setPdfExportTypeDropdownOpen(false);
          setPdfExportStatusDropdownOpen(false);
          setPdfExportColumnsDropdownOpen(false);
          setShowTransactionPdfModal(false);
        }}
      >
        <View style={styles.pdfModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setPdfExportChildDropdownOpen(false);
              setPdfExportTypeDropdownOpen(false);
              setPdfExportStatusDropdownOpen(false);
              setPdfExportColumnsDropdownOpen(false);
              setShowTransactionPdfModal(false);
            }}
          />
          <View style={styles.pdfModalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.pdfModalTitle}>Export PDF statement</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setPdfExportChildDropdownOpen(false);
                  setPdfExportTypeDropdownOpen(false);
                  setPdfExportStatusDropdownOpen(false);
                  setPdfExportColumnsDropdownOpen(false);
                  setShowTransactionPdfModal(false);
                }}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.pdfModalHelp}>
              Choose account scope, transaction type, status, and which columns to include. These settings apply only to this PDF.
            </Text>
            <ScrollView style={styles.pdfModalScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Account</Text>
                <Pressable
                  style={[styles.pdfSelectTrigger, pdfExportChildDropdownOpen && styles.pdfSelectTriggerOpen]}
                  onPress={() => {
                    closePdfExportDropdownsExcept("account");
                    setPdfExportChildDropdownOpen((prev) => !prev);
                  }}
                >
                  <Text style={styles.pdfSelectTriggerText} numberOfLines={1}>
                    {pdfExportAccountLabel}
                  </Text>
                  <Text style={styles.pdfSelectChevron}>{pdfExportChildDropdownOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
                {pdfExportChildDropdownOpen ? (
                  <View style={styles.pdfSelectMenu}>
                    <Pressable
                      style={[styles.pdfSelectOptionRow, pdfExportChildId === "all" && styles.pdfSelectOptionRowActive]}
                      onPress={() => {
                        setPdfExportChildId("all");
                        setPdfExportChildDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.pdfSelectOptionText, pdfExportChildId === "all" && styles.pdfSelectOptionTextActive]}>All accounts</Text>
                      {pdfExportChildId === "all" ? <Text style={styles.pdfSelectOptionCheck}>✓</Text> : <View style={styles.pdfSelectOptionCheckSpacer} />}
                    </Pressable>
                    <Pressable
                      style={[styles.pdfSelectOptionRow, pdfExportChildId === "parent_wallet" && styles.pdfSelectOptionRowActive]}
                      onPress={() => {
                        setPdfExportChildId("parent_wallet");
                        setPdfExportChildDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.pdfSelectOptionText, pdfExportChildId === "parent_wallet" && styles.pdfSelectOptionTextActive]}>Parent wallet</Text>
                      {pdfExportChildId === "parent_wallet" ? <Text style={styles.pdfSelectOptionCheck}>✓</Text> : <View style={styles.pdfSelectOptionCheckSpacer} />}
                    </Pressable>
                    {children.map((child) => (
                      <Pressable
                        key={child.id}
                        style={[styles.pdfSelectOptionRow, pdfExportChildId === child.id && styles.pdfSelectOptionRowActive]}
                        onPress={() => {
                          setPdfExportChildId(child.id);
                          setPdfExportChildDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.pdfSelectOptionText, pdfExportChildId === child.id && styles.pdfSelectOptionTextActive]}>{child.nickname}</Text>
                        {pdfExportChildId === child.id ? <Text style={styles.pdfSelectOptionCheck}>✓</Text> : <View style={styles.pdfSelectOptionCheckSpacer} />}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Type</Text>
                <Pressable
                  style={[styles.pdfSelectTrigger, pdfExportTypeDropdownOpen && styles.pdfSelectTriggerOpen]}
                  onPress={() => {
                    closePdfExportDropdownsExcept("type");
                    setPdfExportTypeDropdownOpen((prev) => !prev);
                  }}
                >
                  <Text style={styles.pdfSelectTriggerText} numberOfLines={1}>
                    {pdfExportTxType === "all" ? "All types" : pdfExportTxType}
                  </Text>
                  <Text style={styles.pdfSelectChevron}>{pdfExportTypeDropdownOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
                {pdfExportTypeDropdownOpen ? (
                  <View style={styles.pdfSelectMenu}>
                    {(["all", "earn", "spend"] as const).map((type) => (
                      <Pressable
                        key={type}
                        style={[styles.pdfSelectOptionRow, pdfExportTxType === type && styles.pdfSelectOptionRowActive]}
                        onPress={() => {
                          setPdfExportTxType(type);
                          setPdfExportTypeDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.pdfSelectOptionText, pdfExportTxType === type && styles.pdfSelectOptionTextActive]}>
                          {type === "all" ? "All types" : type}
                        </Text>
                        {pdfExportTxType === type ? <Text style={styles.pdfSelectOptionCheck}>✓</Text> : <View style={styles.pdfSelectOptionCheckSpacer} />}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Status</Text>
                <Pressable
                  style={[styles.pdfSelectTrigger, pdfExportStatusDropdownOpen && styles.pdfSelectTriggerOpen]}
                  onPress={() => {
                    closePdfExportDropdownsExcept("status");
                    setPdfExportStatusDropdownOpen((prev) => !prev);
                  }}
                >
                  <Text style={styles.pdfSelectTriggerText} numberOfLines={1}>
                    {pdfExportTxStatus === "all" ? "All statuses" : pdfExportTxStatus}
                  </Text>
                  <Text style={styles.pdfSelectChevron}>{pdfExportStatusDropdownOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
                {pdfExportStatusDropdownOpen ? (
                  <View style={styles.pdfSelectMenu}>
                    {(["all", "pending", "approved", "rejected"] as const).map((statusItem) => (
                      <Pressable
                        key={statusItem}
                        style={[styles.pdfSelectOptionRow, pdfExportTxStatus === statusItem && styles.pdfSelectOptionRowActive]}
                        onPress={() => {
                          setPdfExportTxStatus(statusItem);
                          setPdfExportStatusDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.pdfSelectOptionText, pdfExportTxStatus === statusItem && styles.pdfSelectOptionTextActive]}>
                          {statusItem === "all" ? "All statuses" : statusItem}
                        </Text>
                        {pdfExportTxStatus === statusItem ? <Text style={styles.pdfSelectOptionCheck}>✓</Text> : <View style={styles.pdfSelectOptionCheckSpacer} />}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Columns in the PDF</Text>
                <Pressable
                  style={[styles.pdfSelectTrigger, pdfExportColumnsDropdownOpen && styles.pdfSelectTriggerOpen]}
                  onPress={() => {
                    closePdfExportDropdownsExcept("columns");
                    setPdfExportColumnsDropdownOpen((prev) => !prev);
                  }}
                >
                  <Text style={styles.pdfSelectTriggerText} numberOfLines={2}>
                    {pdfColumnsTriggerLabel(pdfExportIncludeFields)}
                  </Text>
                  <Text style={styles.pdfSelectChevron}>{pdfExportColumnsDropdownOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
                {pdfExportColumnsDropdownOpen ? (
                  <View style={styles.pdfSelectMenu}>
                    {(["date", "child", "type", "status", "description", "amount"] as StatementIncludeField[]).map((field, idx, arr) => (
                      <Pressable
                        key={field}
                        style={[styles.pdfSelectCheckboxRow, idx === arr.length - 1 && styles.pdfSelectCheckboxRowLast]}
                        onPress={() => togglePdfExportIncludeField(field)}
                      >
                        <View style={[styles.pdfSelectCheckboxBox, pdfExportIncludeFields.includes(field) && styles.pdfSelectCheckboxBoxOn]}>
                          {pdfExportIncludeFields.includes(field) ? <Text style={styles.pdfSelectCheckboxTick}>✓</Text> : null}
                        </View>
                        <Text style={styles.pdfSelectCheckboxLabel}>{statementIncludeFieldLabel(field)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <AppButton title="Download PDF" loading={submitting} onPress={handleExportTransactionStatementPdf} />
              <Pressable
                style={styles.pdfModalCancel}
                onPress={() => {
                  setPdfExportChildDropdownOpen(false);
                  setPdfExportTypeDropdownOpen(false);
                  setPdfExportStatusDropdownOpen(false);
                  setPdfExportColumnsDropdownOpen(false);
                  setShowTransactionPdfModal(false);
                }}
              >
                <Text style={styles.pdfModalCancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReportPdfModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setReportPdfTxColumnsOpen(false);
          setShowReportPdfModal(false);
          setReportPdfType(null);
        }}
      >
        <View style={styles.pdfModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setReportPdfTxColumnsOpen(false);
              setShowReportPdfModal(false);
              setReportPdfType(null);
            }}
          />
          <View style={styles.pdfModalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.pdfModalTitle}>
                {reportPdfType ? `PDF · ${reportPdfTypeLabel(reportPdfType)}` : "Download report PDF"}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setReportPdfTxColumnsOpen(false);
                  setShowReportPdfModal(false);
                  setReportPdfType(null);
                }}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.pdfModalHelp}>
              Choose the period for this export. Optionally narrow columns (transaction-style reports), fields (spending summary), or sections (monthly snapshot).
            </Text>
            <ScrollView style={styles.pdfModalScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text style={styles.childSelectorLabel}>Period</Text>
              <View style={[styles.childrenTopActions, { marginBottom: 14 }]}>
                <Pressable
                  style={[styles.childrenTopBtn, reportPdfRange === "this_month" && styles.childrenTopBtnPrimary]}
                  onPress={() => setReportPdfRange("this_month")}
                >
                  <Text style={[styles.childrenTopBtnText, reportPdfRange === "this_month" && styles.childrenTopBtnTextPrimary]}>This month</Text>
                </Pressable>
                <Pressable
                  style={[styles.childrenTopBtn, reportPdfRange === "last_30_days" && styles.childrenTopBtnPrimary]}
                  onPress={() => setReportPdfRange("last_30_days")}
                >
                  <Text style={[styles.childrenTopBtnText, reportPdfRange === "last_30_days" && styles.childrenTopBtnTextPrimary]}>Last 30 days</Text>
                </Pressable>
                <Pressable
                  style={[styles.childrenTopBtn, reportPdfRange === "all_time" && styles.childrenTopBtnPrimary]}
                  onPress={() => setReportPdfRange("all_time")}
                >
                  <Text style={[styles.childrenTopBtnText, reportPdfRange === "all_time" && styles.childrenTopBtnTextPrimary]}>All time</Text>
                </Pressable>
              </View>

              {reportPdfType === "transactions" || reportPdfType === "pending" ? (
                <View style={styles.dropdownWrap}>
                  <Text style={styles.childSelectorLabel}>Columns in the PDF</Text>
                  <Pressable
                    style={[styles.pdfSelectTrigger, reportPdfTxColumnsOpen && styles.pdfSelectTriggerOpen]}
                    onPress={() => setReportPdfTxColumnsOpen((prev) => !prev)}
                  >
                    <Text style={styles.pdfSelectTriggerText} numberOfLines={2}>
                      {pdfColumnsTriggerLabel(reportPdfTxInclude)}
                    </Text>
                    <Text style={styles.pdfSelectChevron}>{reportPdfTxColumnsOpen ? "⌃" : "⌄"}</Text>
                  </Pressable>
                  {reportPdfTxColumnsOpen ? (
                    <View style={styles.pdfSelectMenu}>
                      {(["date", "child", "type", "status", "description", "amount"] as StatementIncludeField[]).map((field, idx, arr) => (
                        <Pressable
                          key={field}
                          style={[styles.pdfSelectCheckboxRow, idx === arr.length - 1 && styles.pdfSelectCheckboxRowLast]}
                          onPress={() => toggleReportPdfTxField(field)}
                        >
                          <View style={[styles.pdfSelectCheckboxBox, reportPdfTxInclude.includes(field) && styles.pdfSelectCheckboxBoxOn]}>
                            {reportPdfTxInclude.includes(field) ? <Text style={styles.pdfSelectCheckboxTick}>✓</Text> : null}
                          </View>
                          <Text style={styles.pdfSelectCheckboxLabel}>{statementIncludeFieldLabel(field)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {reportPdfType === "children-overview" ? (
                <View style={styles.dropdownWrap}>
                  <Text style={styles.childSelectorLabel}>Fields per child</Text>
                  <View style={styles.pdfSelectMenu}>
                    {REPORT_CHILD_OVERVIEW_FIELDS.map((field, idx, arr) => (
                      <Pressable
                        key={field}
                        style={[styles.pdfSelectCheckboxRow, idx === arr.length - 1 && styles.pdfSelectCheckboxRowLast]}
                        onPress={() => toggleReportPdfChildField(field)}
                      >
                        <View style={[styles.pdfSelectCheckboxBox, reportPdfChildFields.includes(field) && styles.pdfSelectCheckboxBoxOn]}>
                          {reportPdfChildFields.includes(field) ? <Text style={styles.pdfSelectCheckboxTick}>✓</Text> : null}
                        </View>
                        <Text style={styles.pdfSelectCheckboxLabel}>{REPORT_CHILD_FIELD_LABELS[field]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {reportPdfType === "full-export" ? (
                <View style={styles.dropdownWrap}>
                  <Text style={styles.childSelectorLabel}>Sections</Text>
                  <View style={styles.pdfSelectMenu}>
                    {REPORT_FULL_EXPORT_SECTIONS.map((section, idx, arr) => (
                      <Pressable
                        key={section}
                        style={[styles.pdfSelectCheckboxRow, idx === arr.length - 1 && styles.pdfSelectCheckboxRowLast]}
                        onPress={() => toggleReportPdfSection(section)}
                      >
                        <View style={[styles.pdfSelectCheckboxBox, reportPdfFullSections.includes(section) && styles.pdfSelectCheckboxBoxOn]}>
                          {reportPdfFullSections.includes(section) ? <Text style={styles.pdfSelectCheckboxTick}>✓</Text> : null}
                        </View>
                        <Text style={styles.pdfSelectCheckboxLabel}>{REPORT_SECTION_LABELS[section]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <AppButton title="Download PDF" loading={submitting} onPress={handleDownloadReportPdf} />
              <Pressable
                style={styles.pdfModalCancel}
                onPress={() => {
                  setReportPdfTxColumnsOpen(false);
                  setShowReportPdfModal(false);
                  setReportPdfType(null);
                }}
              >
                <Text style={styles.pdfModalCancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showFundForm && tab !== "children" ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isMobile && styles.mobileSurfaceCard]}>
            <View style={styles.modalHead}>
              <Text style={styles.formCardTitle}>Fund Child Account</Text>
              <Pressable style={styles.modalCloseBtn} onPress={closeFundWalletForm}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            {fundFormLockedChildId ? (
              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Child</Text>
                <View style={styles.dropdownButton}>
                  <Text style={styles.dropdownButtonText}>{children.find((c) => c.id === fundChildId)?.nickname ?? "Selected child"}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.dropdownWrap}>
                <Text style={styles.childSelectorLabel}>Select Child</Text>
                <Pressable style={styles.dropdownButton} onPress={() => setFundChildDropdownOpen((p) => !p)}>
                  <Text style={styles.dropdownButtonText}>{children.find((c) => c.id === fundChildId)?.nickname ?? "Choose a child"}</Text>
                  <Text style={styles.dropdownChevron}>{fundChildDropdownOpen ? "^" : "v"}</Text>
                </Pressable>
                {fundChildDropdownOpen ? (
                  <View style={styles.dropdownMenu}>
                    {children.length === 0 ? (
                      <Text style={styles.dropdownEmptyText}>No children found.</Text>
                    ) : (
                      children.map((child) => (
                        <Pressable
                          key={child.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFundChildId(child.id);
                            setFundChildDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            )}
            <AppInput label="Amount (UGX)" value={fundAmount} onChangeText={setFundAmount} keyboardType="numeric" />
            <AppInput label="Reason" value={fundDescription} onChangeText={setFundDescription} />
            <AppButton title="Send Funds" loading={submitting} onPress={handleFundChild} />
          </View>
        </View>
      ) : null}
      {isMobile ? (
        <View style={[styles.mobileBottomNav, { bottom: 10 + mobileBottomInset }]}>
          <Pressable style={[styles.mobileBottomItem, tab === "home" && styles.mobileBottomItemActive]} onPress={() => handleTabPress("home")}>
            <Text style={[styles.mobileBottomIcon, tab === "home" && styles.mobileBottomIconActive]}>⌂</Text>
            <Text style={[styles.mobileBottomLabel, tab === "home" && styles.mobileBottomLabelActive]}>Home</Text>
          </Pressable>
          <Pressable style={[styles.mobileBottomItem, tab === "children" && styles.mobileBottomItemActive]} onPress={() => handleTabPress("children")}>
            <Text style={[styles.mobileBottomIcon, tab === "children" && styles.mobileBottomIconActive]}>◌</Text>
            <Text style={[styles.mobileBottomLabel, tab === "children" && styles.mobileBottomLabelActive]}>Children</Text>
          </Pressable>
          <Pressable style={[styles.mobileBottomItem, tab === "goals" && styles.mobileBottomItemActive]} onPress={() => handleTabPress("goals")}>
            <Text style={[styles.mobileBottomIcon, tab === "goals" && styles.mobileBottomIconActive]}>◎</Text>
            <Text style={[styles.mobileBottomLabel, tab === "goals" && styles.mobileBottomLabelActive]}>Goals</Text>
          </Pressable>
          <Pressable style={[styles.mobileBottomItem, tab === "transactions" && styles.mobileBottomItemActive]} onPress={() => openTransactionsPage()}>
            <Text style={[styles.mobileBottomIcon, tab === "transactions" && styles.mobileBottomIconActive]}>◔</Text>
            <Text style={[styles.mobileBottomLabel, tab === "transactions" && styles.mobileBottomLabelActive]}>Activity</Text>
          </Pressable>
          <Pressable style={[styles.mobileBottomItem, tab === "settings" && styles.mobileBottomItemActive]} onPress={() => handleTabPress("settings")}>
            <Text style={[styles.mobileBottomIcon, tab === "settings" && styles.mobileBottomIconActive]}>⚙</Text>
            <Text style={[styles.mobileBottomLabel, tab === "settings" && styles.mobileBottomLabelActive]}>Settings</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ChildSelector({
  children,
  selectedId,
  onSelect,
}: {
  children: ParentChildSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (children.length === 0) return null;
  return (
    <View style={styles.childSelectorWrap}>
      <Text style={styles.childSelectorLabel}>Select Child</Text>
      <View style={styles.chipRow}>
        {children.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[styles.chip, selectedId === c.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, selectedId === c.id && styles.chipTextActive]}>
              {c.nickname}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: MAIN_BG,
    position: "relative",
  },
  containerMobile: {
    flexDirection: "column",
    backgroundColor: MAIN_BG,
  },
  mobileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 12, 30, 0.45)",
    zIndex: 5,
  },
  mobileBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Sidebar ──
  sidebar: {
    width: 230,
    backgroundColor: SIDEBAR_BG,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: "column",
  },
  sidebarMobile: {
    width: 260,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sidebarMobileDrawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 6,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 2, height: 0 },
  },
  sidebarBrand: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: "center",
  },
  sidebarBrandMobile: {
    paddingBottom: 14,
  },
  brandTextMobile: {
    fontSize: 16,
    lineHeight: 20,
  },
  brandText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  sidebarProfileBlock: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 18,
    marginTop: -6,
  },
  sidebarProfileImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sidebarProfileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  sidebarProfileInitial: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
  },
  sidebarProfileName: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    maxWidth: 180,
  },
  navList: {
    flex: 1,
  },
  navListMobile: {
    flex: 1,
  },
  navListMobileInner: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemMobile: {
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  navIcon: {
    fontSize: 16,
  },
  navLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "600",
  },
  navLabelMobile: {
    fontSize: 13,
  },
  navLabelActive: {
    color: "#ffffff",
  },
  navLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  navBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff6b6b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  logoutBtn: {
    paddingVertical: 4,
  },
  logoutText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },

  // ── Main ──
  main: {
    flex: 1,
  },
  mainInner: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  mainInnerMobile: {
    padding: 14,
    paddingBottom: 96,
    gap: 14,
    backgroundColor: MAIN_BG,
  },
  mobileMenuBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mobileMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: SIDEBAR_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileMenuIcon: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  mobileMenuTitle: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "700",
  },
  statusMsg: {
    color: "#027a48",
    fontWeight: "700",
    fontSize: 14,
    backgroundColor: "#ecfdf3",
    borderRadius: 8,
    padding: 10,
  },
  errorMsg: {
    color: "#b42318",
    fontWeight: "700",
    fontSize: 14,
    backgroundColor: "#fef3f2",
    borderRadius: 8,
    padding: 10,
  },
  loadingMsg: {
    color: "#7a80ab",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },

  section: {
    gap: 16,
  },
  pageTitle: {
    color: "#24295c",
    fontSize: 26,
    fontWeight: "800",
  },
  pageTitleMobile: {
    fontSize: 22,
  },
  mobilePageTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 2,
  },

  // Home header
  homeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  homeHeaderMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  welcomeText: {
    color: "#24295c",
    fontSize: 26,
    fontWeight: "800",
  },
  welcomeTextMobile: {
    fontSize: 22,
  },
  desktopHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  desktopTitle: {
    color: "#24295c",
    fontSize: 28,
    fontWeight: "800",
  },
  desktopSubtitle: {
    color: "#7a80ab",
    fontSize: 13,
    marginTop: 4,
  },
  desktopGreeting: {
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "700",
  },
  desktopQuickActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "nowrap",
  },
  desktopActionButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#22315d",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  desktopActionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  desktopActionIcon: {
    fontSize: 14,
  },
  desktopActionText: {
    color: "#24295c",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  desktopKpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  desktopKpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 12,
  },
  desktopKpiLabel: {
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "600",
  },
  desktopKpiValue: {
    color: "#24295c",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  desktopTopPanels: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  desktopBottomPanels: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  desktopPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 14,
    gap: 10,
    shadowColor: "#22315d",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  desktopPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  desktopPanelLink: {
    color: SIDEBAR_BG,
    fontSize: 12,
    fontWeight: "700",
  },
  desktopChildCard: {
    flex: 1,
    minWidth: 230,
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e8f6",
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  desktopChildActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  desktopSmallBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d7deef",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  desktopSmallBtnPrimary: {
    backgroundColor: "#e9f9f5",
    borderColor: "#b7e8da",
  },
  desktopSmallBtnText: {
    color: "#374065",
    fontSize: 12,
    fontWeight: "700",
  },
  desktopSmallBtnPrimaryText: {
    color: "#0d7a66",
  },
  desktopPendingRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  desktopPendingCell: {
    flex: 1,
    color: "#24295c",
    fontSize: 12,
    fontWeight: "600",
  },
  desktopPendingActions: {
    flexDirection: "row",
    gap: 6,
  },
  desktopSimpleRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingVertical: 8,
    gap: 2,
  },
  desktopGoalRow: {
    gap: 6,
    paddingVertical: 6,
  },
  childrenTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  childrenSubtitle: {
    color: "#7a80ab",
    fontSize: 13,
    marginTop: 3,
  },
  childrenTopActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  mobileChildrenActions: {
    justifyContent: "flex-start",
    marginBottom: 12,
  },
  childrenSearchPill: {
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  childrenSearchText: {
    color: "#9ba3be",
    fontSize: 12,
  },
  childrenTopBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  childrenTopBtnPrimary: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  childrenTopBtnText: {
    color: "#303762",
    fontSize: 12,
    fontWeight: "700",
  },
  childrenTopBtnTextPrimary: {
    color: "#ffffff",
  },
  childrenLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  childrenMainCol: {
    flex: 1,
    gap: 12,
  },
  childrenSideCol: {
    width: 280,
    gap: 12,
  },
  childrenCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  childrenCardV2: {
    flex: 1,
    minWidth: 300,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8,
  },
  childrenCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  childrenCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  childrenActivePill: {
    borderRadius: 999,
    backgroundColor: "#ecfdf3",
    color: "#027a48",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  childrenBalanceLabel: {
    color: "#7a80ab",
    fontSize: 12,
  },
  childrenBalanceValue: {
    color: "#1f2a5f",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  childrenMiniStats: {
    flexDirection: "row",
    gap: 8,
  },
  childrenMiniStat: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  childrenMiniStatLabel: {
    color: "#7a80ab",
    fontSize: 11,
  },
  childrenMiniStatValue: {
    color: "#24295c",
    fontSize: 13,
    fontWeight: "700",
  },
  childrenBottomPanels: {
    flexDirection: "row",
    gap: 12,
  },
  childrenSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  childrenSummaryItem: {
    width: "47%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    padding: 8,
    gap: 2,
  },
  childrenSummaryValue: {
    color: "#24295c",
    fontSize: 16,
    fontWeight: "800",
  },
  childrenSummaryLabel: {
    color: "#7a80ab",
    fontSize: 11,
  },
  childrenQuickItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  childrenQuickText: {
    color: "#303762",
    fontSize: 12,
    fontWeight: "700",
  },
  goalsTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  goalsFilterPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  goalsRowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8ebf5",
    backgroundColor: "#fafbff",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalsRowMain: {
    flex: 1,
    gap: 6,
  },
  goalsRowSide: {
    width: 90,
    alignItems: "flex-end",
    gap: 8,
  },
  goalsLegendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  transactionsFilterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  transactionsTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ebf5",
    paddingBottom: 8,
    marginTop: 4,
  },
  transactionsHeadCell: {
    flex: 1,
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "700",
  },
  transactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingVertical: 10,
    gap: 8,
  },
  transactionsCell: {
    flex: 1,
    color: "#24295c",
    fontSize: 12,
    fontWeight: "600",
  },
  settingsGrid: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  settingsSectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6ebfb",
    padding: 16,
    gap: 14,
  },
  settingsInfoGrid: {
    gap: 10,
  },
  settingsInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingVertical: 10,
  },
  settingsInfoLabel: {
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "700",
  },
  settingsInfoValue: {
    color: "#252b5f",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },
  settingsTwoCol: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  settingsTwoColMobile: {
    flexDirection: "column",
  },
  settingsPrimaryCol: {
    flex: 1,
    gap: 10,
  },
  settingsRulesCard: {
    width: "100%",
    maxWidth: 220,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    padding: 14,
    gap: 8,
  },
  settingsRulesTitle: {
    color: "#252b5f",
    fontSize: 13,
    fontWeight: "800",
  },
  settingsRulesText: {
    color: "#5d668d",
    fontSize: 12,
    lineHeight: 17,
  },
  settingsActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  settingsActionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  settingsWarningBtn: {
    borderColor: "#f3c66d",
    backgroundColor: "#fff8e8",
  },
  settingsDangerBtn: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  settingsWarningText: {
    color: "#9a6700",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsDangerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsDangerCard: {
    borderColor: "#fecaca",
  },
  allowancesScheduleGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  allowanceCardV2: {
    flex: 1,
    minWidth: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8ebf5",
    backgroundColor: "#fafbff",
    padding: 10,
    gap: 6,
  },
  progressOverviewRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8ebf5",
    backgroundColor: "#fafbff",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressOverviewChild: {
    width: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressMetricCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: "#d7def1",
    alignItems: "center",
    justifyContent: "center",
  },
  progressMetricText: {
    color: "#24295c",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTotalWrap: {
    width: 80,
    alignItems: "center",
    gap: 2,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeItem: {
    width: "47%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef1f8",
    backgroundColor: "#fafbff",
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  badgeEmoji: {
    fontSize: 18,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingVertical: 10,
  },
  notificationRowUnread: {
    backgroundColor: "#f7f8ff",
  },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4f46e5",
  },
  notificationDotRead: {
    backgroundColor: "#c7cfde",
  },
  notificationContent: {
    flex: 1,
    gap: 2,
  },
  addChildBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addChildBtnMobile: {
    width: "100%",
    alignItems: "center",
  },
  addChildBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },

  // Stat row
  statRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 16,
  },
  statCardMobile: {
    minWidth: "100%",
    padding: 14,
  },
  statLabel: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 14,
  },

  // Section title
  sectionTitle: {
    color: "#24295c",
    fontSize: 18,
    fontWeight: "800",
  },

  // Children grid
  childGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  childCard: {
    flex: 1,
    minWidth: 230,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: TEAL,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  childCardMobile: {
    minWidth: "100%",
  },
  childCardLeft: {
    paddingTop: 2,
  },
  childAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#c8f0ea",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  childAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  childAvatarText: {
    color: "#0d7a66",
    fontWeight: "800",
    fontSize: 16,
  },
  childPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  childPhotoPreview: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    borderColor: "#dbe3ff",
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  childPhotoImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  childPhotoInitial: {
    color: SIDEBAR_BG,
    fontSize: 30,
    fontWeight: "800",
  },
  childPhotoActions: {
    flex: 1,
    gap: 6,
  },
  childFormLabel: {
    color: "#252b5f",
    fontWeight: "700",
    fontSize: 13,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: -4,
  },
  childCardRight: {
    flex: 1,
    gap: 4,
  },
  childName: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 16,
  },
  childEmail: {
    color: "#7a80ab",
    fontSize: 12,
    marginBottom: 6,
  },
  childStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  childStatIcon: {
    fontSize: 13,
  },
  childStatLabel: {
    flex: 1,
    color: "#7a80ab",
    fontSize: 13,
  },
  childStatValue: {
    color: TEAL,
    fontWeight: "700",
    fontSize: 13,
  },
  childStatValueOrange: {
    color: "#f5a623",
  },

  // Activity card
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 24,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  activityEmpty: {
    color: "#7a80ab",
    fontSize: 14,
    textAlign: "center",
  },

  // Pending items
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e4f0",
  },
  pendingItemMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  pendingInfo: {
    flex: 1,
  },
  pendingMain: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 14,
  },
  pendingMeta: {
    color: "#7a80ab",
    fontSize: 12,
  },
  pendingActions: {
    flexDirection: "row",
    gap: 8,
  },
  pendingActionsMobile: {
    width: "100%",
  },
  decisionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  approveBtn: {
    backgroundColor: TEAL,
  },
  approveBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  rejectBtn: {
    backgroundColor: "#fee4e2",
  },
  rejectBtnText: {
    color: "#b42318",
    fontWeight: "700",
    fontSize: 13,
  },

  // Form cards
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 16,
    gap: 12,
  },
  mobileSurfaceCard: {
    borderRadius: 22,
    borderColor: "#dfe5f2",
    shadowColor: "#22315d",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  formCardTitle: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 4,
  },

  // List items
  listItem: {
    backgroundColor: "#f8f9ff",
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e0e4f0",
  },
  listItemMain: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 14,
  },
  listItemMeta: {
    color: "#7a80ab",
    fontSize: 12,
  },

  emptyText: {
    color: "#7a80ab",
    fontSize: 14,
    textAlign: "center",
    padding: 16,
  },

  // Child selector chips
  childSelectorWrap: {
    gap: 8,
  },
  childSelectorLabel: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    backgroundColor: "#f8f9ff",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  chipText: {
    color: "#24295c",
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#ffffff",
  },

  dropdownWrap: {
    gap: 8,
  },
  dropdownButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    backgroundColor: "#ffffff",
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownButtonText: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownChevron: {
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "700",
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
  },
  dropdownItemText: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownEmptyText: {
    color: "#7a80ab",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  toggleRowActive: {
    borderColor: "#9fd9c7",
    backgroundColor: "#ecfdf3",
  },
  toggleRowWarn: {
    borderColor: "#f8caca",
    backgroundColor: "#fff4f4",
  },
  toggleTitle: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  toggleState: {
    color: "#24295c",
    fontSize: 12,
    fontWeight: "800",
  },
  toggleRowGroup: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chipBtn: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8deef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  chipBtnActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#b8c3ff",
  },
  chipBtnText: {
    color: "#4b537c",
    fontSize: 13,
    fontWeight: "700",
  },
  chipBtnTextActive: {
    color: SIDEBAR_BG,
  },
  helperText: {
    color: "#7a80ab",
    fontSize: 12,
    lineHeight: 18,
  },

  // Fund button variant
  fundBtn: {
    backgroundColor: "#4f46e5",
    marginTop: 4,
  },

  // Savings goal cards
  goalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 16,
    gap: 8,
  },
  goalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalTitle: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
  },
  goalStatus: {
    color: "#7a80ab",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  goalStatusDone: {
    color: TEAL,
  },
  goalAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalAmountText: {
    color: "#24295c",
    fontSize: 13,
    fontWeight: "600",
  },
  goalPct: {
    color: TEAL,
    fontWeight: "700",
    fontSize: 13,
  },
  goalMeta: {
    color: "#7a80ab",
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#e0e4f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: TEAL,
    borderRadius: 4,
  },

  // Transaction history row
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  txRowMobile: {
    flexWrap: "wrap",
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
  },
  txTypeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  txEarnBadge: {
    backgroundColor: "#ecfdf3",
  },
  txSpendBadge: {
    backgroundColor: "#fef3f2",
  },
  txTypeBadgeText: {
    fontWeight: "800",
    fontSize: 18,
    color: "#24295c",
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txMain: {
    color: "#24295c",
    fontWeight: "700",
    fontSize: 14,
  },
  txMeta: {
    color: "#7a80ab",
    fontSize: 12,
  },
  txDate: {
    color: "#b0b7d4",
    fontSize: 11,
  },
  txStatusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  txApproved: {
    backgroundColor: "#ecfdf3",
  },
  txRejected: {
    backgroundColor: "#fef3f2",
  },
  txPending: {
    backgroundColor: "#fffbeb",
  },
  txStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#24295c",
    textTransform: "capitalize",
  },

  // Child progress cards
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 16,
    gap: 14,
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#c8f0ea",
    justifyContent: "center",
    alignItems: "center",
  },
  progressAvatarText: {
    color: "#0d7a66",
    fontWeight: "800",
    fontSize: 16,
  },
  progressCardInfo: {
    flex: 1,
  },
  progressChildName: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 16,
  },
  progressChildAge: {
    color: "#7a80ab",
    fontSize: 12,
  },
  progressStatRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  progressStat: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#f8f9ff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  progressStatValue: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
  progressStatLabel: {
    color: "#7a80ab",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  progressItem: {
    gap: 6,
  },
  progressItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressItemLabel: {
    color: "#24295c",
    fontSize: 13,
    fontWeight: "600",
  },
  progressItemPct: {
    color: TEAL,
    fontSize: 13,
    fontWeight: "700",
  },

  // Learning content
  learningSubtitle: {
    color: "#7a80ab",
    fontSize: 14,
    marginBottom: 4,
  },
  lessonCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e4f0",
    padding: 16,
    gap: 10,
  },
  lessonHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  lessonIcon: {
    fontSize: 28,
    lineHeight: 34,
  },
  lessonHeaderText: {
    flex: 1,
    gap: 2,
  },
  lessonTitle: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 15,
  },
  lessonTag: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lessonContent: {
    color: "#4a5080",
    fontSize: 13,
    lineHeight: 20,
  },

  // Mobile visual refresh inspired by reference
  mobileHealthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  mobileHealthTitle: {
    color: "#24295c",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  mobileHealthSubtitle: {
    color: "#6f7597",
    fontSize: 14,
    marginTop: 1,
  },
  mobileHealthHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileProfileWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mobileCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5f2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22315d",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mobileCircleBtnIcon: {
    fontSize: 14,
    color: "#4a5080",
  },  mobileHeaderBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff6b6b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  mobileHeaderBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  mobileAvatarChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SIDEBAR_BG,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#31288f",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  mobileAvatarChipText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  mobileBalanceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#dbe2f1",
    padding: 18,
    gap: 8,
    shadowColor: "#24345f",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  mobileBalanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileBalanceCaption: {
    color: "#6f7597",
    fontSize: 13,
    fontWeight: "600",
  },
  mobileBalancePill: {
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mobileBalancePillText: {
    color: SIDEBAR_BG,
    fontSize: 11,
    fontWeight: "700",
  },
  mobileBalanceAmount: {
    color: "#24295c",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  mobileBalanceSubtext: {
    color: "#7a80ab",
    fontSize: 12,
  },
  mobileSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#dfe5f2",
  },
  mobileSearchIcon: {
    color: "#8a90a9",
    fontSize: 18,
  },
  mobileSearchInput: {
    flex: 1,
    color: "#24295c",
    fontSize: 16,
    paddingVertical: 8,
  },
  mobileSectionTitle: {
    color: "#24295c",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginTop: 4,
  },
  mobileQuickActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  mobileQuickActionBtn: {
    flex: 1,
    position: "relative",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: "#22315d",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  mobileQuickActionAlert: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  mobileQuickActionBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    zIndex: 2,
  },
  mobileQuickActionBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  mobileQuickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileQuickActionIconWrapAlert: {
    backgroundColor: "#ffedd5",
  },
  mobileQuickActionIcon: {
    fontSize: 16,
    color: SIDEBAR_BG,
  },
  mobileQuickActionLabel: {
    color: "#24295c",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    textAlign: "center",
  },
  mobileWithdrawalAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
    padding: 12,
    shadowColor: "#9a3412",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  mobileWithdrawalAlertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#fb923c",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileWithdrawalAlertIcon: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  mobileWithdrawalAlertTextWrap: {
    flex: 1,
  },
  mobileWithdrawalAlertTitle: {
    color: "#7c2d12",
    fontSize: 14,
    fontWeight: "900",
  },
  mobileWithdrawalAlertText: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  mobileWithdrawalAlertLink: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: "900",
  },
  mobileLatestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  mobileLatestTitle: {
    color: "#24295c",
    fontSize: 18,
    fontWeight: "700",
  },
  mobileLatestLink: {
    color: SIDEBAR_BG,
    fontSize: 13,
    fontWeight: "700",
  },
  mobileCardsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 2,
  },
  mobileWalletCard: {
    flex: 1,
    minHeight: 114,
    borderRadius: 18,
    padding: 12,
    justifyContent: "flex-end",
    borderWidth: 1,
  },
  mobileWalletAddCard: {
    maxWidth: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cdd5e8",
    borderStyle: "dashed",
  },
  mobileWalletAddText: {
    color: SIDEBAR_BG,
    fontSize: 26,
    lineHeight: 28,
  },
  mobileWalletCardGold: {
    backgroundColor: "#fff8e8",
    borderColor: "#f1dca3",
  },
  mobileWalletCardBlue: {
    backgroundColor: "#eaf7ff",
    borderColor: "#badff4",
  },
  mobileWalletTitle: {
    color: "#24295c",
    fontWeight: "800",
    fontSize: 15,
  },
  mobileWalletMeta: {
    color: "#6f7597",
    fontSize: 12,
    marginTop: 2,
  },
  mobileWalletValue: {
    color: "#24295c",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  mobileMetricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileMetricIcon: {
    fontSize: 20,
  },
  mobileShortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mobileShortcutCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    minHeight: 108,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mobileShortcutLabel: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "600",
  },
  mobileDeviceList: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe5f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    shadowColor: "#22315d",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  mobileDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1fa",
    gap: 10,
  },
  mobileDeviceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileDeviceIconText: {
    fontSize: 15,
    color: SIDEBAR_BG,
  },
  mobileDeviceInfo: {
    flex: 1,
  },
  mobileDeviceTitle: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "600",
  },
  mobileDeviceMeta: {
    color: "#7a80ab",
    fontSize: 12,
  },
  mobileDeviceAmount: {
    color: "#24295c",
    fontSize: 14,
    fontWeight: "700",
  },
  mobileDeviceAmountPositive: {
    color: "#039855",
  },
  mobileDeviceAmountNegative: {
    color: "#b42318",
  },
  mobileBottomNav: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7deef",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    shadowColor: "#22315d",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  mobileBottomItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mobileBottomItemActive: {
    backgroundColor: "#eef2ff",
  },
  mobileBottomIcon: {
    color: "#8f95a3",
    fontSize: 17,
    fontWeight: "700",
  },
  mobileBottomIconActive: {
    color: SIDEBAR_BG,
  },
  mobileBottomLabel: {
    color: "#8f95a3",
    fontSize: 11,
    fontWeight: "600",
  },
  mobileBottomLabelActive: {
    color: SIDEBAR_BG,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(12, 20, 48, 0.35)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 200,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6ebfb",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 10,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalCloseBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dde4fa",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8faff",
  },
  modalCloseText: {
    color: "#3e4d71",
    fontSize: 12,
    fontWeight: "700",
  },
  pdfModalRoot: {
    flex: 1,
    backgroundColor: "rgba(12, 20, 48, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pdfModalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6ebfb",
    backgroundColor: "#ffffff",
    padding: 16,
    zIndex: 1,
  },
  pdfModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e2b4d",
  },
  pdfModalHelp: {
    fontSize: 13,
    color: "#5c6578",
    marginBottom: 12,
    lineHeight: 18,
  },
  pdfModalScroll: {
    maxHeight: 420,
  },
  pdfModalCancel: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  pdfModalCancelText: {
    color: "#5c6578",
    fontSize: 14,
    fontWeight: "600",
  },

  /** PDF export modal — cleaner selects than legacy dropdowns */
  pdfSelectTrigger: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c9d1e0",
    backgroundColor: "#f4f6fb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pdfSelectTriggerOpen: {
    borderColor: TEAL,
    backgroundColor: "#f0fdfa",
  },
  pdfSelectTriggerText: {
    flex: 1,
    color: "#1a2244",
    fontSize: 15,
    fontWeight: "600",
  },
  pdfSelectChevron: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  pdfSelectMenu: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  pdfSelectOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8ecf4",
    backgroundColor: "#ffffff",
  },
  pdfSelectOptionRowActive: {
    backgroundColor: "#ecfdf9",
  },
  pdfSelectOptionText: {
    flex: 1,
    color: "#334155",
    fontSize: 15,
    fontWeight: "500",
  },
  pdfSelectOptionTextActive: {
    color: "#0f766e",
    fontWeight: "700",
  },
  pdfSelectOptionCheck: {
    color: TEAL,
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
  pdfSelectOptionCheckSpacer: {
    width: 22,
    marginLeft: 8,
  },
  pdfSelectCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8ecf4",
    gap: 12,
    backgroundColor: "#ffffff",
  },
  pdfSelectCheckboxRowLast: {
    borderBottomWidth: 0,
  },
  pdfSelectCheckboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  pdfSelectCheckboxBoxOn: {
    borderColor: TEAL,
    backgroundColor: TEAL,
  },
  pdfSelectCheckboxTick: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  pdfSelectCheckboxLabel: {
    flex: 1,
    color: "#334155",
    fontSize: 15,
    fontWeight: "500",
  },

  reportsTopBarMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 14,
  },
  reportsRangeRowMobile: {
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
  },
  reportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 8,
  },
  reportCard: {
    flex: 1,
    minWidth: 300,
    maxWidth: 520,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  reportCardMobile: {
    minWidth: "100%",
    maxWidth: "100%",
  },
  reportCardKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: TEAL,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  reportCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  reportCardDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 14,
  },
  reportCardStats: {
    gap: 6,
    marginBottom: 16,
  },
  reportCardStatLine: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  reportCardPendingLine: {
    fontSize: 12,
    color: "#475569",
  },
  reportCardMuted: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  reportCardBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  reportCardBtnPrimary: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  reportCardBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  reportCardBtnTextPrimary: {
    color: "#ffffff",
  },
  reportCardActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  reportCardBtnFlex: {
    flex: 1,
    minWidth: 120,
    alignSelf: "stretch",
    alignItems: "center",
  },
});






























