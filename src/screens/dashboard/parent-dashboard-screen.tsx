import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  apiChangePassword,
  apiCreateParentAllowance,
  apiCreateParentChild,
  apiCreateParentChore,
  apiDeleteParentAllowance,
  apiCreateParentSavingsGoal,
  apiParentAllowances,
  apiParentAllTransactions,
  apiParentAccountBalance,
  apiParentChildSavingsGoals,
  apiParentChildren,
  apiParentChores,
  apiParentDeposit,
  apiParentFundChild,
  apiParentPendingTransactions,
  apiParentPreferences,
  apiParentReportSummary,
  apiParentPublishedLessons,
  apiParentSpendingLimit,
  apiParentSupportTickets,
  apiParentNotifications,
  apiParentTransactionDecision,
  apiLogDashboardAction,
  apiUpdateParentAllowance,
  apiUpdateParentAccount,
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
  ParentTransactionSummary,
} from "../../lib/api";
import { AppButton, AppDateInput, AppInput } from "../../ui/controls";

const SIDEBAR_BG = "#3d33a0";
const TEAL = "#1bbfa3";
const MAIN_BG = "#eef0f8";

type ParentDashboardScreenProps = {
  email: string;
  onLogout: () => void;
};

type Tab =
  | "home"
  | "children"
  | "goals"
  | "transactions"
  | "allowances"
  | "chores"
  | "progress"
  | "learning"
  | "limits"
  | "notifications"
  | "reports"
  | "support"
  | "settings";

const navItems: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "children", label: "My Children", icon: "👶" },
  { key: "goals", label: "Savings Goals", icon: "🎯" },
  { key: "transactions", label: "Transactions", icon: "📋" },
  { key: "allowances", label: "Allowances", icon: "💰" },
  { key: "chores", label: "Chores", icon: "✅" },
  { key: "progress", label: "Child Progress", icon: "📊" },
  { key: "learning", label: "Learning Content", icon: "🐦" },
  { key: "limits", label: "Spending Limits", icon: "💳" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "support", label: "Support", icon: "🛟" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

const formatMoney = (value: number) => `UGX ${value.toLocaleString()}`;

const STATIC_LESSONS = [
  {
    id: "s1",
    icon: "🐷",
    tag: "Saving Basics",
    title: "Why Saving Money Matters",
    content: "Saving money means setting aside some of what you earn for later. When you save regularly, your money grows over time and you can buy bigger things you really want — like a bicycle or a school trip.",
  },
  {
    id: "s2",
    icon: "🛒",
    tag: "Needs vs Wants",
    title: "Needs vs Wants",
    content: "Needs are things you must have to survive — food, school supplies, clothes. Wants are things you would like but don't need right now. Learning to tell the difference helps you spend wisely.",
  },
  {
    id: "s3",
    icon: "📊",
    tag: "Budgeting",
    title: "Making a Budget",
    content: "A budget is a plan for your money. Every time you earn money, decide how much to save, how much to spend, and how much to give. A simple rule: save at least 20% of every shilling you receive.",
  },
  {
    id: "s4",
    icon: "📈",
    tag: "Interest",
    title: "How Interest Works",
    content: "Interest is money that grows on your savings. When you keep money in a bank account, the bank pays you a small extra amount called interest. The longer you save, the more interest you earn!",
  },
  {
    id: "s5",
    icon: "🛡️",
    tag: "Safety",
    title: "Staying Safe with Money",
    content: "Never share your PIN or password with anyone — not even friends. If someone asks you to send money quickly or promises you free money, tell a trusted adult. Fraudsters try to steal money by tricking people.",
  },
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ParentDashboardScreen({ email, onLogout }: ParentDashboardScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [tab, setTab] = useState<Tab>("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCreateChildForm, setShowCreateChildForm] = useState(false);
  const sidebarTranslateX = useMemo(() => new Animated.Value(-280), []);
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const username = email.split("@")[0];

  const [children, setChildren] = useState<ParentChildSummary[]>([]);
  const [pending, setPending] = useState<ParentPendingTransaction[]>([]);
  const [chores, setChores] = useState<ParentChoreSummary[]>([]);
  const [allowances, setAllowances] = useState<ParentAllowanceSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const safeError = error && /unauthorized/i.test(error) ? "Please log in to continue." : error;

  const [childFullName, setChildFullName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childNickname, setChildNickname] = useState("");
  const [childAge, setChildAge] = useState("10");

  const [selectedChildId, setSelectedChildId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [limitPeriodType, setLimitPeriodType] = useState<"weekly" | "monthly" | "quarterly">("monthly");

  const [choreTitle, setChoreTitle] = useState("");
  const [choreDescription, setChoreDescription] = useState("");
  const [choreRewardAmount, setChoreRewardAmount] = useState("2000");
  const [choreDueDate, setChoreDueDate] = useState("");

  const [allowanceTitle, setAllowanceTitle] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [allowanceDate, setAllowanceDate] = useState("");
  const [allowanceNotes, setAllowanceNotes] = useState("");
  const [showAllowanceForm, setShowAllowanceForm] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const [allowanceChildDropdownOpen, setAllowanceChildDropdownOpen] = useState(false);
  const [choreChildDropdownOpen, setChoreChildDropdownOpen] = useState(false);
  const [showAssignChoreForm, setShowAssignChoreForm] = useState(false);
  const [limitsChildDropdownOpen, setLimitsChildDropdownOpen] = useState(false);
  const [goalsChildDropdownOpen, setGoalsChildDropdownOpen] = useState(false);
  const [fundChildDropdownOpen, setFundChildDropdownOpen] = useState(false);

  const [savingsGoals, setSavingsGoals] = useState<ParentSavingsGoalSummary[]>([]);
  const [allChildGoals, setAllChildGoals] = useState<Array<ParentSavingsGoalSummary & { childId: string; childName: string }>>([]);
  const [goalViewChildId, setGoalViewChildId] = useState("all");
  const [allTransactions, setAllTransactions] = useState<ParentTransactionSummary[]>([]);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalChildId, setGoalChildId] = useState("");
  const [showCreateGoalOnly, setShowCreateGoalOnly] = useState(false);

  const [fundChildId, setFundChildId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundDescription, setFundDescription] = useState("");
  const [showFundForm, setShowFundForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [parentAccount, setParentAccount] = useState<ParentAccountBalance>({
    balance: 0,
    totalDeposited: 0,
  });

  const [accountFullName, setAccountFullName] = useState("");
  const [accountNin, setAccountNin] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountEmail, setAccountEmail] = useState(email);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
  const [supportTickets, setSupportTickets] = useState<ParentSupportTicket[]>([]);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [reportSummary, setReportSummary] = useState<ParentReportSummary>({
    approvedCount: 0,
    pendingCount: 0,
    totalSpent: 0,
    totalEarned: 0,
    goalsCompleted: 0,
    choresCompleted: 0,
  });

  const totalChildBalance = useMemo(
    () => children.reduce((sum, child) => sum + (child.wallet?.balance ?? 0), 0),
    [children]
  );

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

  async function loadParentData() {
    setLoading(true);
    setError("");

    try {
      const [childrenData, pendingData, choresData, allowancesData, transactionsData, lessonsData, preferencesData, reportsData, supportData, notificationsData, parentAccountData] = await Promise.all([
        apiParentChildren(),
        apiParentPendingTransactions(),
        apiParentChores(),
        apiParentAllowances(),
        apiParentAllTransactions(),
        apiParentPublishedLessons().catch(() => ({ lessons: [] as AdminLesson[] })),
        apiParentPreferences(),
        apiParentReportSummary(),
        apiParentSupportTickets(),
        apiParentNotifications(),
        apiParentAccountBalance(),
      ]);

      setChildren(childrenData.children);
      setPending(pendingData.pending);
      setChores(choresData.chores);
      setAllowances(allowancesData.allowances);
      setAllTransactions(transactionsData.transactions);
      setLessons(lessonsData.lessons);
      await loadAllGoalsForChildren(childrenData.children);
      applyPreferences(preferencesData.preferences);
      setReportSummary(reportsData.summary);
      setSupportTickets(supportData.tickets);
      setNotifications(notificationsData.notifications);
      setParentAccount(parentAccountData);

      if (childrenData.children.length > 0) {
        if (!selectedChildId) setSelectedChildId(childrenData.children[0].id);
        if (!goalChildId) setGoalChildId(childrenData.children[0].id);
        if (!fundChildId) setFundChildId(childrenData.children[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load parent dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParentData();
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

  async function handleCreateChild() {
    const fullName = childFullName.trim();
    const nickname = childNickname.trim();
    const emailValue = childEmail.trim().toLowerCase();
    const passwordValue = childPassword.trim();
    const age = Number(childAge);

    if (fullName.length < 3) {
      setError("Enter the child's full name (at least 3 characters).");
      return;
    }
    if (nickname.length < 2) {
      setError("Enter a nickname (at least 2 characters).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("Enter a valid child email address.");
      return;
    }
    if (passwordValue.length < 8) {
      setError("Child password must be at least 8 characters.");
      return;
    }
    if (!Number.isFinite(age) || age < 5 || age > 17) {
      setError("Child age must be between 5 and 17.");
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
      });
      setStatus(data.message);
      setChildFullName("");
      setChildEmail("");
      setChildPassword("");
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

  async function handleDecision(id: string, decision: "approved" | "rejected") {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiParentTransactionDecision(id, decision);
      setStatus(data.message);
      await loadParentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetLimit() {
    const monthlyLimit = Number(limitAmount);
    if (!selectedChildId) {
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
      const data = await apiParentSpendingLimit({ childId: selectedChildId, monthlyLimit, periodType: limitPeriodType });
      setStatus(data.message);
      setLimitAmount("");
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

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiCreateParentAllowance({
        childId: selectedChildId,
        title: allowanceTitle,
        amount,
        availableOn: allowanceDate,
        notes: allowanceNotes || undefined,
      });
      setStatus(data.message);
      setAllowanceTitle("");
      setAllowanceAmount("");
      setAllowanceDate("");
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

    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiUpdateParentAllowance(editingAllowanceId, {
        childId: selectedChildId,
        title: allowanceTitle,
        amount,
        availableOn: allowanceDate,
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

  async function handleUpdateAccount() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiUpdateParentAccount({
        fullName: accountFullName,
        nin: accountNin,
        phoneNumber: accountPhone,
        email: accountEmail,
      });
      setStatus(data.message);
      setAccountFullName(data.profile.fullName);
      setAccountNin(data.profile.nin);
      setAccountPhone(data.profile.phoneNumber);
      setAccountEmail(data.profile.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword() {
    setSubmitting(true);
    clearMessages();
    try {
      const data = await apiChangePassword({ currentPassword, newPassword, confirmPassword });
      setStatus(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
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
      setShowFundForm(false);
      await loadParentData();
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

  function handleTabPress(nextTab: Tab) {
    void apiLogDashboardAction({ dashboard: "parent", action: `Open tab: ${nextTab}` }).catch(() => undefined);
    setTab(nextTab);
    if (nextTab !== "children") {
      setShowCreateChildForm(false);
      setShowFundForm(false);
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
      setLimitsChildDropdownOpen(false);
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
    setAllowanceNotes("");
    setAllowanceChildDropdownOpen(false);
    setShowAllowanceForm(true);
    handleTabPress("allowances");
  }

  function handleOpenCreateGoal() {
    setShowCreateGoalOnly(true);
    handleTabPress("goals");
  }

  const activeTabLabel = navItems.find((item) => item.key === tab)?.label ?? "Dashboard";
  const notificationBadgeCount = Math.min(9, notifications.length);
  const openSupportCount = Math.min(9, supportTickets.filter((ticket) => ticket.status === "open").length);
  const visibleGoalRows = allChildGoals.filter((goal) => goalViewChildId === "all" || goal.childId === goalViewChildId);
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

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
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
          <Text style={[styles.brandText, isMobile && styles.brandTextMobile]}>$ Kids Banking</Text>
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

        <View style={[styles.sidebarFooter, isMobile && styles.sidebarFooterMobile]}>
          <View style={styles.footerUserRow}>
            <View style={styles.footerAvatar}>
              <Text style={styles.footerAvatarText}>{username[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={styles.footerUserInfo}>
              <Text style={styles.footerUsername} numberOfLines={1}>{username}</Text>
              <Text style={styles.footerEmail} numberOfLines={1}>{email}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Main Content ── */}
      <ScrollView style={styles.main} contentContainerStyle={[styles.mainInner, isMobile && styles.mainInnerMobile]}>
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
              <Pressable style={styles.mobileCircleBtn}>
                <Text style={styles.mobileCircleBtnIcon}>🔔</Text>
              </Pressable>
              <Pressable style={styles.mobileCircleBtn} onPress={() => handleTabPress("transactions")}>
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
                  <Text style={styles.mobileBalanceSubtext}>Parent account • {children.length} children • {pending.length} pending approvals</Text>
                </View>

                <View style={styles.mobileQuickActionRow}>
                  <Pressable style={styles.mobileQuickActionBtn} onPress={() => handleTabPress("children")}>
                    <View style={styles.mobileQuickActionIconWrap}>
                      <Text style={styles.mobileQuickActionIcon}>➕</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Add Child</Text>
                  </Pressable>
                  <Pressable
                    style={styles.mobileQuickActionBtn}
                    onPress={() => {
                      if (children.length > 0) {
                        setFundChildId((prev) => prev || children[0].id);
                      }
                      setShowFundForm(true);
                      handleTabPress("children");
                    }}
                  >
                    <View style={styles.mobileQuickActionIconWrap}>
                      <Text style={styles.mobileQuickActionIcon}>⌁</Text>
                    </View>
                    <Text style={styles.mobileQuickActionLabel}>Fund</Text>
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
                {showDepositForm ? (
                  <View style={[styles.formCard, styles.mobileSurfaceCard]}>
                    <Text style={styles.formCardTitle}>Deposit to Parent Account</Text>
                    <AppInput label="Amount (UGX)" value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" />
                    <AppButton title="Deposit Money" loading={submitting} onPress={handleParentDeposit} />
                  </View>
                ) : null}

                <View style={styles.mobileLatestHeader}>
                  <Text style={styles.mobileLatestTitle}>Latest Transactions</Text>
                  <Pressable onPress={() => handleTabPress("transactions")}>
                    <Text style={styles.mobileLatestLink}>View All</Text>
                  </Pressable>
                </View>

                <View style={styles.mobileDeviceList}>
                  {allTransactions.length === 0 ? (
                    <Text style={styles.activityEmpty}>No transactions yet.</Text>
                  ) : (
                    allTransactions.slice(0, 5).map((item) => (
                      <Pressable key={item.id} style={styles.mobileDeviceRow} onPress={() => handleTabPress("transactions")}>
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
                  <Text style={styles.desktopGreeting}>Good morning!</Text>
                </View>

                <View style={styles.desktopQuickActions}>
                  <Pressable style={styles.desktopActionButton} onPress={() => handleTabPress("children")}>
                    <View style={styles.desktopActionIconWrap}><Text style={styles.desktopActionIcon}>👶</Text></View>
                    <Text style={styles.desktopActionText}>Add Child</Text>
                  </Pressable>
                  <Pressable
                    style={styles.desktopActionButton}
                    onPress={() => {
                      setShowFundForm(true);
                      handleTabPress("children");
                    }}
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
                    <Text style={styles.desktopKpiValue}>{children.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Parent Account Balance</Text>
                    <Text style={styles.desktopKpiValue}>{formatMoney(parentAccount.balance)}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Pending Approvals</Text>
                    <Text style={styles.desktopKpiValue}>{pending.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Active Savings Goals</Text>
                    <Text style={styles.desktopKpiValue}>{activeSavingsGoals.length}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Completed Chores</Text>
                    <Text style={styles.desktopKpiValue}>{completedChores}</Text>
                  </View>
                  <View style={styles.desktopKpiCard}>
                    <Text style={styles.desktopKpiLabel}>Learning Progress</Text>
                    <Text style={styles.desktopKpiValue}>{Math.min(100, lessons.length * 10)}%</Text>
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
                              <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
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
                              <Pressable style={styles.desktopSmallBtn} onPress={() => handleTabPress("progress")}>
                                <Text style={styles.desktopSmallBtnText}>View Profile</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                onPress={() => {
                                  setFundChildId(child.id);
                                  setShowFundForm(true);
                                  handleTabPress("children");
                                }}
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
                      <Pressable onPress={() => handleTabPress("transactions")}>
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
                      <Pressable onPress={() => handleTabPress("transactions")}>
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
                    {allChildGoals.slice(0, 4).map((goal) => {
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
                    {allChildGoals.length === 0 ? <Text style={styles.activityEmpty}>No goals yet.</Text> : null}
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
                    <Pressable style={styles.childrenTopBtn} onPress={() => setShowFundForm(true)}>
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
                        const weeklyLimit = child.activeSpendingLimit ?? 0;
                        const balance = child.wallet?.balance ?? 0;
                        const progress = weeklyLimit > 0 ? Math.min(100, Math.round((balance / weeklyLimit) * 100)) : 0;

                        return (
                          <View key={child.id} style={styles.childrenCardV2}>
                            <View style={styles.childrenCardHeader}>
                              <View style={styles.childrenCardHeaderLeft}>
                                <View style={styles.childAvatar}>
                                  <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
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
                                <Text style={styles.childrenMiniStatLabel}>Weekly Limit</Text>
                                <Text style={styles.childrenMiniStatValue}>{formatMoney(weeklyLimit)}</Text>
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
                              <Pressable style={styles.desktopSmallBtn} onPress={() => handleTabPress("progress")}>
                                <Text style={styles.desktopSmallBtnText}>View Profile</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                onPress={() => {
                                  setFundChildId(child.id);
                                  setShowFundForm(true);
                                }}
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
                          <Pressable onPress={() => handleTabPress("transactions")}>
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
                          <Pressable onPress={() => handleTabPress("transactions")}>
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

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <Pressable style={styles.childrenQuickItem} onPress={() => setShowCreateChildForm(true)}>
                        <Text style={styles.childrenQuickText}>Add New Child</Text>
                      </Pressable>
                      <Pressable style={styles.childrenQuickItem} onPress={() => handleTabPress("limits")}>
                        <Text style={styles.childrenQuickText}>Set Family Spending Limit</Text>
                      </Pressable>
                      <Pressable style={styles.childrenQuickItem} onPress={handleOpenCreateGoal}>
                        <Text style={styles.childrenQuickText}>Create Savings Goal</Text>
                      </Pressable>
                      <Pressable style={styles.childrenQuickItem} onPress={() => handleOpenAssignChoreForm()}>
                        <Text style={styles.childrenQuickText}>Assign Chore</Text>
                      </Pressable>
                      <Pressable style={styles.childrenQuickItem} onPress={() => handleTabPress("transactions")}>
                        <Text style={styles.childrenQuickText}>View Transactions</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.childGrid}>
                {children.map((child) => (
                  <View key={child.id} style={[styles.childCard, styles.childCardMobile, styles.mobileSurfaceCard]}>
                    <View style={styles.childCardLeft}>
                      <View style={styles.childAvatar}>
                        <Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text>
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
                    </View>
                  </View>
                ))}
                {children.length === 0 && <Text style={styles.emptyText}>No child accounts yet.</Text>}
              </View>
            )}

            {!showCreateChildForm ? (
              <Pressable
                style={[styles.addChildBtn, isMobile && styles.addChildBtnMobile]}
                onPress={() => setShowCreateChildForm(true)}
              >
                <Text style={styles.addChildBtnText}>+ Add Child</Text>
              </Pressable>
            ) : null}

            {showCreateChildForm ? (
              <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                <Text style={styles.formCardTitle}>Create Child Account</Text>
                <AppInput label="Full Name" value={childFullName} onChangeText={setChildFullName} />
                <AppInput label="Nickname" value={childNickname} onChangeText={setChildNickname} />
                <AppInput label="Age" value={childAge} onChangeText={setChildAge} keyboardType="numeric" />
                <AppInput label="Email" value={childEmail} onChangeText={setChildEmail} keyboardType="email-address" />
                <AppInput label="Password" value={childPassword} onChangeText={setChildPassword} secureTextEntry />
                <AppButton title="Create Child" loading={submitting} onPress={handleCreateChild} />
                <AppButton title="Cancel" variant="ghost" onPress={() => setShowCreateChildForm(false)} />
              </View>
            ) : null}

              {!showFundForm && !showCreateChildForm ? (
                <Pressable
                  style={[styles.addChildBtn, styles.fundBtn, isMobile && styles.addChildBtnMobile]}
                  onPress={() => setShowFundForm(true)}
                >
                  <Text style={styles.addChildBtnText}>💳 Fund Child Account</Text>
                </Pressable>
              ) : null}

              {showFundForm ? (
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Fund Child Account</Text>
                  <View style={styles.dropdownWrap}>
                    <Text style={styles.childSelectorLabel}>Select Child</Text>
                    <Pressable style={styles.dropdownButton} onPress={() => setFundChildDropdownOpen((p) => !p)}>
                      <Text style={styles.dropdownButtonText}>
                        {children.find((c) => c.id === fundChildId)?.nickname ?? "Choose a child"}
                      </Text>
                      <Text style={styles.dropdownChevron}>{fundChildDropdownOpen ? "▲" : "▼"}</Text>
                    </Pressable>
                    {fundChildDropdownOpen ? (
                      <View style={styles.dropdownMenu}>
                        {children.length === 0 ? (
                          <Text style={styles.dropdownEmptyText}>No children found.</Text>
                        ) : (
                          children.map((child) => (
                            <Pressable key={child.id} style={styles.dropdownItem}
                              onPress={() => { setFundChildId(child.id); setFundChildDropdownOpen(false); }}>
                              <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                  <AppInput label="Amount (UGX)" value={fundAmount} onChangeText={setFundAmount} keyboardType="numeric" />
                  <AppInput label="Description (optional)" value={fundDescription} onChangeText={setFundDescription} />
                  <AppButton title="Send Funds" loading={submitting} onPress={handleFundChild} />
                  <AppButton title="Cancel" variant="ghost" onPress={() => setShowFundForm(false)} />
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
                      {visibleGoalRows.map((goal) => {
                        const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                        return (
                          <View key={goal.id} style={styles.goalsRowCard}>
                            <View style={styles.goalsRowMain}>
                              <Text style={styles.listItemMain}>{goal.childName} - {goal.title}</Text>
                              <Text style={styles.listItemMeta}>{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}</Text>
                              <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                              </View>
                            </View>
                            <View style={styles.goalsRowSide}>
                              <Text style={styles.goalPct}>{pct}%</Text>
                              <Pressable
                                style={[styles.desktopSmallBtn, styles.desktopSmallBtnPrimary]}
                                onPress={() => {
                                  setFundChildId(goal.childId);
                                  setShowFundForm(true);
                                  handleTabPress("children");
                                }}
                              >
                                <Text style={[styles.desktopSmallBtnText, styles.desktopSmallBtnPrimaryText]}>Add Money</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                      {visibleGoalRows.length === 0 ? <Text style={styles.activityEmpty}>No savings goals found.</Text> : null}
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
                    <Text style={styles.childrenSubtitle}>View and track all wallet transactions across your children's accounts.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <Pressable style={styles.childrenTopBtn}>
                      <Text style={styles.childrenTopBtnText}>Export Statement</Text>
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
                      <View style={styles.transactionsFilterRow}>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>All Children</Text></View>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>All Types</Text></View>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>All Statuses</Text></View>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>Date Range</Text></View>
                        <View style={styles.goalsFilterPill}><Text style={styles.childrenTopBtnText}>Filter</Text></View>
                      </View>

                      <View style={styles.transactionsTableHeader}>
                        <Text style={styles.transactionsHeadCell}>Date</Text>
                        <Text style={styles.transactionsHeadCell}>Child</Text>
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
                      {allTransactions.length === 0 ? <Text style={styles.activityEmpty}>No transactions found yet.</Text> : null}
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

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Send Money</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Request Money</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Export Statement</Text></View>
                    </View>
                  </View>
                </View>
              </>
            ) : allTransactions.length === 0 ? (
              <View style={[styles.activityCard, isMobile && styles.mobileSurfaceCard]}>
                <Text style={styles.activityEmpty}>No transactions found yet.</Text>
              </View>
            ) : (
              <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                {allTransactions.map((item, idx) => (
                  <View key={item.id}
                    style={[styles.txRow, isMobile && styles.txRowMobile, idx < allTransactions.length - 1 && styles.txRowBorder]}>
                    <View style={[styles.txTypeBadge, item.type === "earn" ? styles.txEarnBadge : styles.txSpendBadge]}>
                      <Text style={styles.txTypeBadgeText}>{item.type === "earn" ? "+" : "−"}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txMain}>
                        {item.childName} · {formatMoney(item.amount)}
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
                        {allowances.slice(0, 3).map((allowance) => (
                          <View key={allowance.id} style={styles.allowanceCardV2}>
                            <View style={styles.desktopPanelHeader}>
                              <Text style={styles.listItemMain}>{allowance.childName}</Text>
                              <Text style={styles.childrenActivePill}>{allowance.isActive ? "Active" : "Paused"}</Text>
                            </View>
                            <Text style={styles.childrenSummaryLabel}>{allowance.title}</Text>
                            <Text style={styles.childrenSummaryValue}>{formatMoney(allowance.amount)}</Text>
                            <Text style={styles.listItemMeta}>Next Payment: {new Date(allowance.availableOn).toLocaleDateString()}</Text>
                            <View style={styles.desktopChildActions}>
                              <Pressable
                                style={styles.desktopSmallBtn}
                                onPress={() => {
                                  setEditingAllowanceId(allowance.id);
                                  setSelectedChildId(allowance.childId);
                                  setAllowanceTitle(allowance.title);
                                  setAllowanceAmount(String(allowance.amount));
                                  setAllowanceDate(allowance.availableOn.slice(0, 10));
                                  setAllowanceNotes(allowance.notes ?? "");
                                  setAllowanceChildDropdownOpen(false);
                                  setShowAllowanceForm(true);
                                }}
                              >
                                <Text style={styles.desktopSmallBtnText}>View Details</Text>
                              </Pressable>
                              {allowance.isActive ? (
                                <Pressable
                                  style={styles.desktopSmallBtn}
                                  onPress={() => handleDeleteAllowance(allowance.id)}
                                >
                                  <Text style={styles.desktopSmallBtnText}>Delete & Refund</Text>
                                </Pressable>
                              ) : (
                                <Pressable style={styles.desktopSmallBtn} disabled>
                                  <Text style={styles.desktopSmallBtnText}>Already Paid</Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                      {allowances.length === 0 ? <Text style={styles.activityEmpty}>No allowances scheduled yet.</Text> : null}
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
                          <Text style={styles.listItemMeta}>{item.title} - {new Date(item.availableOn).toLocaleDateString()}</Text>
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
                            <Pressable style={styles.desktopSmallBtn}>
                              <Text style={styles.desktopSmallBtnText}>View</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      {chores.length === 0 ? <Text style={styles.activityEmpty}>No chores yet.</Text> : null}
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
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
                      <Text style={styles.sectionTitle}>Chore Summary</Text>
                      <Text style={styles.childrenSummaryValue}>{chores.length}</Text>
                      <Text style={styles.childrenSummaryLabel}>Total</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Pending</Text><Text style={styles.listItemMain}>{pendingChoresCount}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Completed</Text><Text style={styles.listItemMain}>{completedChores}</Text></View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Pending Approvals</Text>
                      {chores.filter((c) => c.status === "assigned").slice(0, 4).map((c) => (
                        <View key={c.id} style={styles.desktopSimpleRow}>
                          <Text style={styles.listItemMain}>{c.title}</Text>
                          <Text style={styles.listItemMeta}>{c.childName}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Recent Rewards Paid</Text>
                      {approvedTransactions
                        .filter((tx) => (tx.description ?? "").toLowerCase().includes("chore"))
                        .slice(0, 4)
                        .map((tx) => (
                          <View key={tx.id} style={styles.desktopSimpleRow}>
                            <Text style={styles.listItemMain}>{tx.childName}</Text>
                            <Text style={styles.listItemMeta}>+ {formatMoney(tx.amount)}</Text>
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

        {/* CHILD PROGRESS */}
        {!loading && tab === "progress" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Child Progress</Text>
                    <Text style={styles.childrenSubtitle}>Track your children's growth across savings, learning, and financial skills.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <View style={styles.childrenTopBtn}><Text style={styles.childrenTopBtnText}>May 1 - May 15, 2025</Text></View>
                    <View style={styles.childrenTopBtn}><Text style={styles.childrenTopBtnText}>Export Report</Text></View>
                  </View>
                </View>

                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Learning Progress</Text><Text style={styles.desktopKpiValue}>{Math.max(60, Math.min(95, lessons.length * 12))}%</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Savings Progress</Text><Text style={styles.desktopKpiValue}>{avgGoalProgress}%</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Budgeting Skills</Text><Text style={styles.desktopKpiValue}>{Math.max(55, Math.min(90, 60 + children.length * 4))}%</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Chore Completion</Text><Text style={styles.desktopKpiValue}>{chores.length > 0 ? Math.round((completedChores / chores.length) * 100) : 0}%</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Badges Earned</Text><Text style={styles.desktopKpiValue}>{children.length * 3 + lessons.length}</Text></View>
                </View>

                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Progress Overview by Child</Text>
                      {children.map((child) => {
                        const childChores = chores.filter((c) => c.childId === child.id);
                        const choresPct = childChores.length > 0 ? Math.round((childChores.filter((c) => c.status === "completed").length / childChores.length) * 100) : 0;
                        const childGoals = allChildGoals.filter((g) => g.childId === child.id);
                        const savingsPct = childGoals.length > 0
                          ? Math.round(childGoals.reduce((sum, g) => sum + (g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0), 0) / childGoals.length)
                          : 0;
                        const learningPct = Math.max(55, Math.min(92, 60 + (child.age % 5) * 6));
                        const budgetingPct = Math.max(50, Math.min(88, 58 + (child.age % 4) * 5));
                        const totalScore = Math.round((learningPct + savingsPct + budgetingPct + choresPct) / 4);
                        return (
                          <View key={child.id} style={styles.progressOverviewRow}>
                            <View style={styles.progressOverviewChild}>
                              <View style={styles.childAvatar}><Text style={styles.childAvatarText}>{getInitials(child.nickname)}</Text></View>
                              <View><Text style={styles.listItemMain}>{child.nickname}</Text><Text style={styles.listItemMeta}>Age {child.age}</Text></View>
                            </View>
                            <View style={styles.progressMetricCircle}><Text style={styles.progressMetricText}>{learningPct}%</Text></View>
                            <View style={styles.progressMetricCircle}><Text style={styles.progressMetricText}>{savingsPct}%</Text></View>
                            <View style={styles.progressMetricCircle}><Text style={styles.progressMetricText}>{budgetingPct}%</Text></View>
                            <View style={styles.progressMetricCircle}><Text style={styles.progressMetricText}>{choresPct}%</Text></View>
                            <View style={styles.progressTotalWrap}><Text style={styles.childrenSummaryValue}>{totalScore}%</Text><Text style={styles.childrenSummaryLabel}>Total Score</Text></View>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.childrenBottomPanels}>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Detailed Progress Breakdown</Text>
                        <View style={styles.transactionsTableHeader}>
                          <Text style={styles.transactionsHeadCell}>Module</Text>
                          <Text style={styles.transactionsHeadCell}>Amina</Text>
                          <Text style={styles.transactionsHeadCell}>Daniel</Text>
                          <Text style={styles.transactionsHeadCell}>Status</Text>
                        </View>
                        {["Saving Basics", "Needs vs Wants", "Budgeting", "Interest & Growth", "Fraud Awareness"].map((moduleName, index) => (
                          <View key={moduleName} style={styles.transactionsRow}>
                            <Text style={styles.transactionsCell}>{moduleName}</Text>
                            <Text style={styles.transactionsCell}>{Math.max(50, 85 - index * 5)}%</Text>
                            <Text style={styles.transactionsCell}>{Math.max(45, 75 - index * 4)}%</Text>
                            <View style={[styles.txStatusPill, index % 2 === 0 ? styles.txApproved : styles.txPending]}>
                              <Text style={styles.txStatusText}>{index % 2 === 0 ? "Completed" : "In Progress"}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Recent Achievements</Text>
                        {approvedTransactions
                          .filter((tx) => (tx.description ?? "").toLowerCase().includes("chore"))
                          .slice(0, 4)
                          .map((tx) => (
                            <View key={tx.id} style={styles.desktopSimpleRow}>
                              <Text style={styles.listItemMain}>{tx.childName}</Text>
                              <Text style={styles.listItemMeta}>{tx.description ?? "Chore achievement"}</Text>
                            </View>
                          ))}
                        <Text style={styles.desktopPanelLink}>View all achievements</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Child Comparison</Text>
                      <Text style={styles.childrenSummaryLabel}>This month snapshot</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Learning</Text><Text style={styles.listItemMain}>75% vs 68%</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Savings</Text><Text style={styles.listItemMain}>70% vs 66%</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Budgeting</Text><Text style={styles.listItemMain}>68% vs 62%</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Chores</Text><Text style={styles.listItemMain}>82% vs 78%</Text></View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Badges Earned</Text>
                      <View style={styles.badgesGrid}>
                        {["Saver", "Helper", "Learner", "Consistent", "Budget Master", "Smart Spender"].map((badge) => (
                          <View key={badge} style={styles.badgeItem}>
                            <Text style={styles.badgeEmoji}>🏅</Text>
                            <Text style={styles.childrenSummaryLabel}>{badge}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Child Progress</Text>
                {children.length === 0 ? (
                  <View style={[styles.activityCard, isMobile && styles.mobileSurfaceCard]}>
                    <Text style={styles.activityEmpty}>No children added yet.</Text>
                  </View>
                ) : (
                  children.map((child) => {
                    const childChores = chores.filter((c) => c.childId === child.id);
                    const completedChildChores = childChores.filter((c) => c.status === "completed").length;
                    const totalChores = childChores.length;
                    const choresPct = totalChores > 0 ? Math.round((completedChildChores / totalChores) * 100) : 0;
                    const childAllowances = allowances.filter((a) => a.childId === child.id);
                    const totalAllowanceValue = childAllowances.reduce((sum, a) => sum + a.amount, 0);

                    return (
                      <View key={child.id} style={[styles.progressCard, isMobile && styles.mobileSurfaceCard]}>
                        <View style={styles.progressCardHeader}>
                          <View style={styles.progressAvatar}>
                            <Text style={styles.progressAvatarText}>{getInitials(child.nickname)}</Text>
                          </View>
                          <View style={styles.progressCardInfo}>
                            <Text style={styles.progressChildName}>{child.nickname}</Text>
                            <Text style={styles.progressChildAge}>Age {child.age}</Text>
                          </View>
                        </View>
                        <View style={styles.progressStatRow}>
                          <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>{formatMoney(child.wallet?.balance ?? 0)}</Text>
                            <Text style={styles.progressStatLabel}>Balance</Text>
                          </View>
                          <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>{formatMoney(child.wallet?.totalEarned ?? 0)}</Text>
                            <Text style={styles.progressStatLabel}>Total Earned</Text>
                          </View>
                          <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>{formatMoney(child.wallet?.totalSpent ?? 0)}</Text>
                            <Text style={styles.progressStatLabel}>Total Spent</Text>
                          </View>
                        </View>
                        <View style={styles.progressItem}>
                          <View style={styles.progressItemHeader}>
                            <Text style={styles.progressItemLabel}>Chore Completion</Text>
                            <Text style={styles.progressItemPct}>{completedChildChores}/{totalChores} ({choresPct}%)</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${choresPct}%` as any }]} />
                          </View>
                        </View>
                        <View style={styles.progressItem}>
                          <Text style={styles.progressItemLabel}>
                            Allowances Scheduled: {childAllowances.length} ({formatMoney(totalAllowanceValue)} total)
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
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

            {lessons.length > 0 ? (
              lessons.filter((l) => l.isPublished).map((lesson) => (
                <View key={lesson.id} style={[styles.lessonCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonContent} numberOfLines={4}>{lesson.content}</Text>
                </View>
              ))
            ) : null}

            {STATIC_LESSONS.map((lesson) => (
              <View key={lesson.id} style={[styles.lessonCard, isMobile && styles.mobileSurfaceCard]}>
                <View style={styles.lessonHeader}>
                  <Text style={styles.lessonIcon}>{lesson.icon}</Text>
                  <View style={styles.lessonHeaderText}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonTag}>{lesson.tag}</Text>
                  </View>
                </View>
                <Text style={styles.lessonContent}>{lesson.content}</Text>
              </View>
            ))}
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
                    <Pressable style={[styles.childrenTopBtn, styles.childrenTopBtnPrimary]} onPress={() => setLimitsChildDropdownOpen((p) => !p)}>
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
                                    setSelectedChildId(child.id);
                                    setLimitAmount(limit > 0 ? String(limit) : "");
                                    if (child.activeSpendingLimitPeriod) setLimitPeriodType(child.activeSpendingLimitPeriod);
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

                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Update Spending Limit</Text>
                      <View style={styles.dropdownWrap}>
                        <Text style={styles.childSelectorLabel}>Select Child</Text>
                        <Pressable style={styles.dropdownButton} onPress={() => setLimitsChildDropdownOpen((p) => !p)}>
                          <Text style={styles.dropdownButtonText}>
                            {children.find((c) => c.id === selectedChildId)?.nickname ?? "Choose a child"}
                          </Text>
                          <Text style={styles.dropdownChevron}>{limitsChildDropdownOpen ? "▲" : "▼"}</Text>
                        </Pressable>
                        {limitsChildDropdownOpen ? (
                          <View style={styles.dropdownMenu}>
                            {children.length === 0 ? (
                              <Text style={styles.dropdownEmptyText}>No children found.</Text>
                            ) : (
                              children.map((child) => (
                                <Pressable key={child.id} style={styles.dropdownItem}
                                  onPress={() => { setSelectedChildId(child.id); setLimitsChildDropdownOpen(false); }}>
                                  <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                                </Pressable>
                              ))
                            )}
                          </View>
                        ) : null}
                      </View>
                      <AppInput label="Limit Amount (UGX)" value={limitAmount} onChangeText={setLimitAmount} keyboardType="numeric" />
                      <View style={styles.toggleRowGroup}>
                        {(["weekly", "monthly", "quarterly"] as const).map((period) => (
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

                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Policy Controls</Text>
                      <Pressable style={[styles.toggleRow, withdrawalApprovalRequired && styles.toggleRowActive]} onPress={() => setWithdrawalApprovalRequired((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Require withdrawal approval</Text>
                        <Text style={styles.toggleState}>{withdrawalApprovalRequired ? "ON" : "OFF"}</Text>
                      </Pressable>
                      <Pressable style={[styles.toggleRow, enableAccountFreeze && styles.toggleRowWarn]} onPress={() => setEnableAccountFreeze((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Temporary account freeze</Text>
                        <Text style={styles.toggleState}>{enableAccountFreeze ? "ACTIVE" : "INACTIVE"}</Text>
                      </Pressable>
                      <AppInput label="Merchant restrictions" value={merchantRestrictions} onChangeText={setMerchantRestrictions} placeholder="gambling, night clubs" />
                      <AppInput label="Quiet hours" value={quietHours} onChangeText={setQuietHours} placeholder="21:00 - 06:00" />
                      <AppButton title="Save Policies" loading={submitting} onPress={handleSavePreferences} />
                    </View>

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
                  <Text style={styles.formCardTitle}>Set Spending Limit</Text>
                  <View style={styles.dropdownWrap}>
                    <Text style={styles.childSelectorLabel}>Select Child</Text>
                    <Pressable style={styles.dropdownButton} onPress={() => setLimitsChildDropdownOpen((p) => !p)}>
                      <Text style={styles.dropdownButtonText}>
                        {children.find((c) => c.id === selectedChildId)?.nickname ?? "Choose a child"}
                      </Text>
                      <Text style={styles.dropdownChevron}>{limitsChildDropdownOpen ? "▲" : "▼"}</Text>
                    </Pressable>
                    {limitsChildDropdownOpen ? (
                      <View style={styles.dropdownMenu}>
                        {children.length === 0 ? (
                          <Text style={styles.dropdownEmptyText}>No children found.</Text>
                        ) : (
                          children.map((child) => (
                            <Pressable key={child.id} style={styles.dropdownItem}
                              onPress={() => { setSelectedChildId(child.id); setLimitsChildDropdownOpen(false); }}>
                              <Text style={styles.dropdownItemText}>{child.nickname}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                  <AppInput label="Limit Amount (UGX)" value={limitAmount} onChangeText={setLimitAmount} keyboardType="numeric" />
                  <View style={styles.toggleRowGroup}>
                    {(["weekly", "monthly", "quarterly"] as const).map((period) => (
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
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Parental Controls</Text>
                  <Pressable style={[styles.toggleRow, withdrawalApprovalRequired && styles.toggleRowActive]} onPress={() => setWithdrawalApprovalRequired((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Require approval for withdrawals</Text>
                    <Text style={styles.toggleState}>{withdrawalApprovalRequired ? "ON" : "OFF"}</Text>
                  </Pressable>
                  <Pressable style={[styles.toggleRow, enableAccountFreeze && styles.toggleRowWarn]} onPress={() => setEnableAccountFreeze((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Temporary account freeze</Text>
                    <Text style={styles.toggleState}>{enableAccountFreeze ? "ACTIVE" : "INACTIVE"}</Text>
                  </Pressable>
                  <AppInput label="Merchant restrictions (comma separated)" value={merchantRestrictions} onChangeText={setMerchantRestrictions} placeholder="gambling, night clubs" />
                  <AppInput label="Quiet hours" value={quietHours} onChangeText={setQuietHours} placeholder="21:00 - 06:00" />
                  <AppButton title="Save Parental Controls" loading={submitting} onPress={handleSavePreferences} />
                </View>
              </>
            )}
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
                    <Pressable style={styles.childrenTopBtn}>
                      <Text style={styles.childrenTopBtnText}>Mark all as read</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <View style={styles.chipRow}>
                        {["All", "Unread", "Transactions", "Allowances", "Chores", "System"].map((label, idx) => (
                          <View key={label} style={[styles.chip, idx === 0 && styles.chipActive]}>
                            <Text style={[styles.chipText, idx === 0 && styles.chipTextActive]}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      {notifications.length === 0 ? (
                        <Text style={styles.activityEmpty}>No alerts yet.</Text>
                      ) : (
                        notifications.slice(0, 12).map((item) => (
                          <View key={item.id} style={styles.notificationRow}>
                            <View style={styles.notificationDot} />
                            <View style={styles.notificationContent}>
                              <Text style={styles.listItemMain}>{item.message}</Text>
                              <Text style={styles.listItemMeta}>{item.type.replace(/_/g, " ")}</Text>
                            </View>
                            <Text style={styles.listItemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Notification Settings</Text>
                      <Pressable style={[styles.toggleRow, notifyDeposits && styles.toggleRowActive]} onPress={() => setNotifyDeposits((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Allowance Alerts</Text>
                        <Text style={styles.toggleState}>{notifyDeposits ? "ON" : "OFF"}</Text>
                      </Pressable>
                      <Pressable style={[styles.toggleRow, notifyWithdrawals && styles.toggleRowActive]} onPress={() => setNotifyWithdrawals((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Chore Alerts</Text>
                        <Text style={styles.toggleState}>{notifyWithdrawals ? "ON" : "OFF"}</Text>
                      </Pressable>
                      <Pressable style={[styles.toggleRow, notifySuspiciousLogins && styles.toggleRowActive]} onPress={() => setNotifySuspiciousLogins((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Spending Alerts</Text>
                        <Text style={styles.toggleState}>{notifySuspiciousLogins ? "ON" : "OFF"}</Text>
                      </Pressable>
                      <Pressable style={[styles.toggleRow, notifyGoals && styles.toggleRowActive]} onPress={() => setNotifyGoals((prev) => !prev)}>
                        <Text style={styles.toggleTitle}>Goal Updates</Text>
                        <Text style={styles.toggleState}>{notifyGoals ? "ON" : "OFF"}</Text>
                      </Pressable>
                      <AppButton title="Save Notification Preferences" loading={submitting} onPress={handleSavePreferences} />
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Notifications</Text>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Alert Preferences</Text>
                  <Pressable style={[styles.toggleRow, notifyDeposits && styles.toggleRowActive]} onPress={() => setNotifyDeposits((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Deposit alerts</Text>
                    <Text style={styles.toggleState}>{notifyDeposits ? "ON" : "OFF"}</Text>
                  </Pressable>
                  <Pressable style={[styles.toggleRow, notifyWithdrawals && styles.toggleRowActive]} onPress={() => setNotifyWithdrawals((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Withdrawal requests and approvals</Text>
                    <Text style={styles.toggleState}>{notifyWithdrawals ? "ON" : "OFF"}</Text>
                  </Pressable>
                  <Pressable style={[styles.toggleRow, notifySuspiciousLogins && styles.toggleRowActive]} onPress={() => setNotifySuspiciousLogins((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Suspicious login attempts</Text>
                    <Text style={styles.toggleState}>{notifySuspiciousLogins ? "ON" : "OFF"}</Text>
                  </Pressable>
                  <Pressable style={[styles.toggleRow, notifyGoals && styles.toggleRowActive]} onPress={() => setNotifyGoals((prev) => !prev)}>
                    <Text style={styles.toggleTitle}>Savings milestones and goals</Text>
                    <Text style={styles.toggleState}>{notifyGoals ? "ON" : "OFF"}</Text>
                  </Pressable>
                  <AppButton title="Save Notification Preferences" loading={submitting} onPress={handleSavePreferences} />
                </View>
              </>
            )}
          </View>
        )}

        {/* REPORTS */}
        {!loading && tab === "reports" && (
          <View style={styles.section}>
            {!isMobile ? (
              <>
                <View style={styles.goalsTopBar}>
                  <View>
                    <Text style={styles.pageTitle}>Reports</Text>
                    <Text style={styles.childrenSubtitle}>View insights and activity reports across all accounts.</Text>
                  </View>
                  <View style={styles.childrenTopActions}>
                    <View style={styles.childrenTopBtn}><Text style={styles.childrenTopBtnText}>This Month</Text></View>
                  </View>
                </View>
                <View style={styles.desktopKpiGrid}>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Total Income</Text><Text style={styles.desktopKpiValue}>{formatMoney(reportSummary.totalEarned)}</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Total Spending</Text><Text style={styles.desktopKpiValue}>{formatMoney(reportSummary.totalSpent)}</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Total Savings</Text><Text style={styles.desktopKpiValue}>{formatMoney(totalChildBalance)}</Text></View>
                  <View style={styles.desktopKpiCard}><Text style={styles.desktopKpiLabel}>Total Allowances</Text><Text style={styles.desktopKpiValue}>{formatMoney(totalAllowancesValue)}</Text></View>
                </View>
                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Spending Overview</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Shopping</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.37))}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Food & Drinks</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.29))}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Education</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.2))}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Others</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.14))}</Text></View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Recent Reports</Text>
                      {[
                        "Monthly Summary - May 2025",
                        "Allowance Report",
                        "Spending by Category",
                        "Chores & Rewards Report",
                      ].map((item) => (
                        <View key={item} style={styles.desktopSimpleRow}>
                          <Text style={styles.listItemMain}>{item}</Text>
                          <Text style={styles.desktopPanelLink}>View</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.childrenSideCol}>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Top Categories</Text>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Shopping</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.37))}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Food & Drinks</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.29))}</Text></View>
                      <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Entertainment</Text><Text style={styles.listItemMain}>{formatMoney(Math.round(reportSummary.totalSpent * 0.08))}</Text></View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Export to PDF</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Export to Excel</Text></View>
                      <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Print Report</Text></View>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Reports & Analytics</Text>
                <View style={styles.statRow}>
                  <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                    <Text style={styles.statLabel}>Approved transactions: {reportSummary.approvedCount}</Text>
                  </View>
                  <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                    <Text style={styles.statLabel}>Pending approvals: {reportSummary.pendingCount}</Text>
                  </View>
                  <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                    <Text style={styles.statLabel}>Total spent: {formatMoney(reportSummary.totalSpent)}</Text>
                  </View>
                  <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                    <Text style={styles.statLabel}>Total earned: {formatMoney(reportSummary.totalEarned)}</Text>
                  </View>
                </View>
              </>
            )}
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
            {!isMobile ? (
              <>
                <View>
                  <Text style={styles.pageTitle}>Settings</Text>
                  <Text style={styles.childrenSubtitle}>Manage your account, preferences, and security settings.</Text>
                </View>
                <View style={styles.childrenLayout}>
                  <View style={styles.childrenMainCol}>
                    <View style={styles.settingsGrid}>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Account Settings</Text>
                        <Text style={styles.listItemMain}>{username}</Text>
                        <Text style={styles.listItemMeta}>{email}</Text>
                        <AppInput label="Full Name" value={accountFullName} onChangeText={setAccountFullName} />
                        <AppInput label="NIN" value={accountNin} onChangeText={setAccountNin} autoCapitalize="characters" />
                        <AppInput label="Phone Number" value={accountPhone} onChangeText={setAccountPhone} keyboardType="phone-pad" />
                        <AppInput label="Email" value={accountEmail} onChangeText={setAccountEmail} keyboardType="email-address" />
                        <AppButton title="Save Account" loading={submitting} onPress={handleUpdateAccount} />
                      </View>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Security</Text>
                        <AppInput label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
                        <AppInput label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                        <AppInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                        <AppButton title="Update Password" loading={submitting} onPress={handleChangePassword} />
                        <Pressable style={[styles.toggleRow, notifySuspiciousLogins && styles.toggleRowActive]} onPress={() => setNotifySuspiciousLogins((prev) => !prev)}>
                          <Text style={styles.toggleTitle}>Login Alerts</Text>
                          <Text style={styles.toggleState}>{notifySuspiciousLogins ? "ON" : "OFF"}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.settingsGrid}>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Preferences</Text>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Currency</Text><Text style={styles.listItemMain}>UGX</Text></View>
                        <View style={styles.goalsLegendItem}><Text style={styles.childrenSummaryLabel}>Language</Text><Text style={styles.listItemMain}>English</Text></View>
                        <Pressable style={[styles.toggleRow, notifyDeposits && styles.toggleRowActive]} onPress={() => setNotifyDeposits((prev) => !prev)}>
                          <Text style={styles.toggleTitle}>Weekly Summary Emails</Text>
                          <Text style={styles.toggleState}>{notifyDeposits ? "ON" : "OFF"}</Text>
                        </Pressable>
                        <Pressable style={[styles.toggleRow, notifyGoals && styles.toggleRowActive]} onPress={() => setNotifyGoals((prev) => !prev)}>
                          <Text style={styles.toggleTitle}>Marketing Emails</Text>
                          <Text style={styles.toggleState}>{notifyGoals ? "ON" : "OFF"}</Text>
                        </Pressable>
                      </View>
                      <View style={styles.desktopPanel}>
                        <Text style={styles.sectionTitle}>Family & Children</Text>
                        <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Manage Children</Text></View>
                        <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Default Allowance Day</Text></View>
                        <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Approval Settings</Text></View>
                        <Text style={styles.sectionTitle}>Data & Privacy</Text>
                        <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Download My Data</Text></View>
                        <View style={styles.childrenQuickItem}><Text style={styles.childrenQuickText}>Delete Account</Text></View>
                      </View>
                    </View>
                    <View style={styles.desktopPanel}>
                      <Text style={styles.sectionTitle}>Need Help?</Text>
                      <Text style={styles.listItemMeta}>Contact support for account assistance and security requests.</Text>
                      <AppButton title="Contact Support" onPress={() => handleTabPress("support")} />
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.pageTitle, isMobile && styles.mobilePageTitle]}>Settings</Text>
                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Account Information</Text>
                  <AppInput label="Full Name" value={accountFullName} onChangeText={setAccountFullName} />
                  <AppInput label="NIN" value={accountNin} onChangeText={setAccountNin} autoCapitalize="characters" />
                  <AppInput label="Phone Number" value={accountPhone} onChangeText={setAccountPhone} keyboardType="phone-pad" />
                  <AppInput label="Email" value={accountEmail} onChangeText={setAccountEmail} keyboardType="email-address" />
                  <AppButton title="Save Account" loading={submitting} onPress={handleUpdateAccount} />
                </View>

                <View style={[styles.formCard, isMobile && styles.mobileSurfaceCard]}>
                  <Text style={styles.formCardTitle}>Change Password</Text>
                  <AppInput label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
                  <AppInput label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                  <AppInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                  <AppButton title="Update Password" loading={submitting} onPress={handleChangePassword} />
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {isMobile ? (
        <View style={styles.mobileBottomNav}>
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
          <Pressable style={[styles.mobileBottomItem, tab === "transactions" && styles.mobileBottomItemActive]} onPress={() => handleTabPress("transactions")}>
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
  sidebarFooter: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  sidebarFooterMobile: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  footerUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  footerAvatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  footerUserInfo: {
    flex: 1,
  },
  footerUsername: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  footerEmail: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
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
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4f46e5",
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
  },
  childAvatarText: {
    color: "#0d7a66",
    fontWeight: "800",
    fontSize: 16,
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
  mobileQuickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileQuickActionIcon: {
    fontSize: 16,
    color: SIDEBAR_BG,
  },
  mobileQuickActionLabel: {
    color: "#24295c",
    fontSize: 11,
    fontWeight: "700",
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
});
