import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  AllowanceSummary,
  apiChangePassword,
  apiChildAllowances,
  apiChildChores,
  apiChildLearningLessons,
  apiChildSavingsGoals,
  apiChildTransactions,
  apiChildWallet,
  apiCompleteChildChore,
  apiCreateChildWithdrawal,
  apiCreateChildSavingsGoal,
  apiCreateChildTransaction,
  apiFundChildGoal,
  apiLogDashboardAction,
  apiUpdateChildLearningProgress,
  API_BASE_URL,
  ChildAchievementSummary,
  ChildLearningLesson,
  ChoreSummary,
  SavingsGoalSummary,
  TransactionSummary,
  WalletSummary,
} from "../../lib/api";
import { AppButton, AppInput } from "../../ui/controls";
import { theme } from "../../ui/theme";

type ChildDashboardScreenProps = {
  email: string;
  onLogout: () => void;
};

type TabKey =
  | "home"
  | "wallet"
  | "learn"
  | "transactions"
  | "notifications"
  | "savings"
  | "chores"
  | "allowances"
  | "actions"
  | "settings";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "wallet", label: "My Wallet" },
  { key: "learn", label: "Learn & Earn" },
  { key: "transactions", label: "Transactions" },
  { key: "notifications", label: "Notifications" },
  { key: "savings", label: "Savings Goals" },
  { key: "chores", label: "My Chores" },
  { key: "allowances", label: "Allowances" },
  { key: "actions", label: "Quick Actions" },
  { key: "settings", label: "Settings" },
];

const webNavItems: Array<{ label: string; key: TabKey; icon: string }> = [
  { label: "Home", key: "home", icon: "H" },
  { label: "Wallet", key: "wallet", icon: "$" },
  { label: "Goals", key: "savings", icon: "*" },
  { label: "Chores", key: "chores", icon: "+" },
  { label: "Learn & Earn", key: "learn", icon: "A" },
  { label: "Transactions", key: "transactions", icon: "T" },
  { label: "Notifications", key: "notifications", icon: "!" },
  { label: "Profile", key: "settings", icon: "P" },
];

const formatMoney = (value: number) => `UGX ${value.toLocaleString()}`;
const walletIllustration1 = require("../../../assets/wallet/Wallet1.jpg");
const walletIllustration2 = require("../../../assets/wallet/Wallet2.jpg");
const walletIllustration3 = require("../../../assets/wallet/Wallet3.jpg");
const walletIllustration4 = require("../../../assets/wallet/Wallet4.jpg");
const walletIllustration5 = require("../../../assets/wallet/Wallet5.jpg");
const bgIllustration1 = require("../../../assets/Background/Background1.jpg");
const bgIllustration2 = require("../../../assets/Background/Background2.jpg");
const bgIllustration3 = require("../../../assets/Background/Background3.jpg");
const bgIllustration4 = require("../../../assets/Background/Background4.jpg");
const bgIllustration5 = require("../../../assets/Background/Background5.jpg");
const bgIllustration6 = require("../../../assets/Background/Background6.jpg");

function getTabBackgroundImage(tab: TabKey) {
  if (tab === "home") return bgIllustration1;
  if (tab === "wallet") return bgIllustration2;
  if (tab === "savings") return bgIllustration3;
  if (tab === "chores") return bgIllustration4;
  if (tab === "learn") return bgIllustration5;
  if (tab === "transactions") return bgIllustration6;
  if (tab === "notifications") return bgIllustration2;
  if (tab === "settings") return bgIllustration3;
  if (tab === "actions") return bgIllustration4;
  return bgIllustration1;
}

type AnimatedTileButtonProps = {
  children: React.ReactNode;
  style?: object | object[];
  onPress: () => void | Promise<void>;
};

function AnimatedTileButton({ children, style, onPress }: AnimatedTileButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 3,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 5,
    }).start();
  }

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function ChildDashboardScreen({ email, onLogout }: ChildDashboardScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const username = email.split("@")[0];

  const [tab, setTab] = useState<TabKey>("home");
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [chores, setChores] = useState<ChoreSummary[]>([]);
  const [allowances, setAllowances] = useState<AllowanceSummary[]>([]);
  const [assignedLessons, setAssignedLessons] = useState<ChildLearningLesson[]>([]);
  const [achievements, setAchievements] = useState<ChildAchievementSummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [txType, setTxType] = useState<"earn" | "spend">("earn");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");

  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [fundGoalAmounts, setFundGoalAmounts] = useState<Record<string, string>>({});
  const [fundingGoalId, setFundingGoalId] = useState<string | null>(null);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawSource, setWithdrawSource] = useState<"wallet" | "goal">("wallet");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawGoalId, setWithdrawGoalId] = useState("");
  const [withdrawDescription, setWithdrawDescription] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayBalance, setDisplayBalance] = useState(0);
  const [showReward, setShowReward] = useState(false);

  const balanceAnim = useRef(new Animated.Value(0)).current;
  const homeEnterAnim = useRef(new Animated.Value(0)).current;
  const activeTabAnim = useRef(new Animated.Value(1)).current;
  const rewardAnim = useRef(new Animated.Value(0)).current;

  const completedChores = useMemo(
    () => chores.filter((chore) => chore.status === "completed").length,
    [chores]
  );
  const pendingChores = useMemo(() => chores.filter((chore) => chore.status === "assigned").length, [chores]);
  const totalChoreRewards = useMemo(
    () => chores.filter((chore) => chore.status === "completed").reduce((sum, chore) => sum + chore.rewardAmount, 0),
    [chores]
  );
  const featuredGoal = savingsGoals[0];
  const latestAllowance = allowances[0];
  const pendingTransactions = useMemo(() => transactions.filter((tx) => tx.status === "pending").length, [transactions]);
  const totalSavings = useMemo(() => savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0), [savingsGoals]);
  const activeGoalProgress = featuredGoal
    ? Math.min(100, Math.round((featuredGoal.currentAmount / featuredGoal.targetAmount) * 100))
    : 0;
  const walletBalance = wallet?.balance ?? 0;
  const walletEarned = wallet?.totalEarned ?? 0;
  const walletSpent = wallet?.totalSpent ?? 0;
  const completedGoalsCount = useMemo(
    () => savingsGoals.filter((goal) => goal.status === "completed" || Boolean(goal.completedAt)).length,
    [savingsGoals]
  );
  const completedSavingsGoals = useMemo(
    () => savingsGoals.filter((goal) => goal.status === "completed" || Boolean(goal.completedAt)),
    [savingsGoals]
  );
  const withdrawableCompletedGoals = useMemo(
    () => completedSavingsGoals.filter((goal) => goal.currentAmount > 0),
    [completedSavingsGoals]
  );
  const activeSavingsGoals = useMemo(
    () => savingsGoals.filter((goal) => goal.status !== "completed" && !goal.completedAt),
    [savingsGoals]
  );
  const goldenStarCount = useMemo(
    () => achievements.filter((achievement) => achievement.title.toLowerCase().includes("golden star")).length,
    [achievements]
  );
  const avgGoalProgress = useMemo(() => {
    if (savingsGoals.length === 0) return 0;
    const total = savingsGoals.reduce((sum, goal) => {
      if (goal.targetAmount <= 0) return sum;
      return sum + Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
    }, 0);
    return Math.round(total / savingsGoals.length);
  }, [savingsGoals]);
  const totalMoneyIn = useMemo(
    () => transactions.filter((tx) => tx.type === "earn").reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  );
  const totalMoneyOut = useMemo(
    () => transactions.filter((tx) => tx.type === "spend").reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  );
  const netBalance = totalMoneyIn - totalMoneyOut;
  const safeErrorMessage =
    errorMessage && /unauthorized/i.test(errorMessage) ? "Please log in to continue." : errorMessage;
  const profileMenuItems = [
    "Wallet",
    "Goals",
    "Transactions",
    "Chores",
    "Learn & Earn",
    "Notifications",
    "Settings",
    "Security & Privacy",
    "Help & Support",
    "About Kids Banking",
  ];

  function handleProfileMenuPress(item: string) {
    void apiLogDashboardAction({ dashboard: "child", action: `Profile Menu: ${item}` }).catch(() => undefined);

    if (item === "Wallet") {
      setTxType("earn");
      setTab("actions");
      setStatusMessage("Wallet actions are available in Quick Actions.");
      return;
    }
    if (item === "Goals") {
      setTab("savings");
      return;
    }
    if (item === "Transactions") {
      setTab("transactions");
      return;
    }
    if (item === "Chores") {
      setTab("chores");
      return;
    }
    if (item === "Learn & Earn") {
      setTab("learn");
      return;
    }
    if (item === "Settings") {
      setTab("settings");
      return;
    }
    if (item === "Notifications") {
      setTab("notifications");
      return;
    }

    setStatusMessage(`${item} screen is coming soon.`);
  }
  const learningLessons = useMemo(
    () =>
      assignedLessons.map((lesson) => {
        const completed = lesson.status === "completed";
        const progress = completed ? 100 : Math.min(99, Math.max(0, lesson.progressPercent));
        return {
          ...lesson,
          id: lesson.assignmentId,
          subtitle: `${lesson.resourceType.toUpperCase()}${lesson.fileName ? ` • ${lesson.fileName}` : ""}`,
          statusLabel: completed ? "Completed" : progress > 0 ? "In Progress" : "Ready",
          progress,
          resourceLabel: lesson.resourceType === "video" ? "Watch" : lesson.resourceType === "pdf" ? "Open PDF" : "Read",
        };
      }),
    [assignedLessons]
  );
  const completedLearningCount = learningLessons.filter((lesson) => lesson.progress >= 100).length;
  const learningProgressPercent = learningLessons.length
    ? Math.round(learningLessons.reduce((total, lesson) => total + lesson.progress, 0) / learningLessons.length)
    : 0;

  async function loadDashboardData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [walletData, txData, savingsData, choresData, allowancesData, lessonsData] = await Promise.all([
        apiChildWallet(),
        apiChildTransactions(),
        apiChildSavingsGoals(),
        apiChildChores(),
        apiChildAllowances(),
        apiChildLearningLessons().catch(() => ({ lessons: [] as ChildLearningLesson[] })),
      ]);

      setWallet(walletData.wallet);
      setSavingsGoals(walletData.savingsGoals.length > 0 ? walletData.savingsGoals : savingsData.savingsGoals);
      setAchievements(walletData.achievements ?? []);
      setTransactions(txData.transactions);
      setChores(choresData.chores);
      setAllowances(allowancesData.allowances);
      setAssignedLessons(lessonsData.lessons);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load child dashboard";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const listenerId = balanceAnim.addListener(({ value }) => {
      setDisplayBalance(Math.max(0, Math.round(value)));
    });
    return () => {
      balanceAnim.removeListener(listenerId);
    };
  }, [balanceAnim]);

  useEffect(() => {
    const targetBalance = wallet?.balance ?? 0;
    Animated.timing(balanceAnim, {
      toValue: targetBalance,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [balanceAnim, wallet?.balance]);

  useEffect(() => {
    if (!isMobile || tab !== "home") return;
    homeEnterAnim.setValue(0);
    Animated.timing(homeEnterAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [homeEnterAnim, isMobile, tab]);

  useEffect(() => {
    if (!isMobile) return;
    activeTabAnim.setValue(0.86);
    Animated.spring(activeTabAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 9,
    }).start();
  }, [activeTabAnim, isMobile, tab]);

  useEffect(() => {
    if (!showReward) return;
    rewardAnim.setValue(0);
    Animated.sequence([
      Animated.spring(rewardAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 10,
      }),
      Animated.timing(rewardAnim, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start(() => setShowReward(false));
  }, [rewardAnim, showReward]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  function clearMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handleCreateTransaction() {
    const amount = Number(txAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid transaction amount.");
      return;
    }

    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiCreateChildTransaction({
        amount,
        type: txType,
        description: txDescription.trim() || undefined,
      });
      setStatusMessage(data.message);
      setTxAmount("");
      setTxDescription("");
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create transaction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSavingsGoal() {
    const amount = Number(goalAmount);
    if (!goalTitle.trim()) {
      setErrorMessage("Goal title is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid target amount.");
      return;
    }

    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiCreateChildSavingsGoal({ title: goalTitle.trim(), targetAmount: amount });
      setStatusMessage(data.message);
      setGoalTitle("");
      setGoalAmount("");
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create savings goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFundGoal(goalId: string) {
    const raw = fundGoalAmounts[goalId] ?? "";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid amount to fund this goal.");
      return;
    }
    if (!wallet || wallet.balance < amount) {
      setErrorMessage("You don't have enough money in your wallet.");
      return;
    }

    setIsSubmitting(true);
    setFundingGoalId(goalId);
    clearMessages();

    try {
      const data = await apiFundChildGoal({ goalId, amount });
      setStatusMessage(data.message);
      setWallet(data.wallet);
      setSavingsGoals((prev) => prev.map((g) => (g.id === goalId ? data.goal : g)));
      setFundGoalAmounts((prev) => ({ ...prev, [goalId]: "" }));
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not fund goal.");
    } finally {
      setIsSubmitting(false);
      setFundingGoalId(null);
    }
  }

  async function handleCreateWithdrawal() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid withdrawal amount.");
      return;
    }

    if (withdrawSource === "wallet" && wallet && amount > wallet.balance) {
      setErrorMessage("You do not have enough money in your wallet.");
      return;
    }

    if (withdrawSource === "goal") {
      const selectedGoal = completedSavingsGoals.find((goal) => goal.id === withdrawGoalId);
      if (!selectedGoal) {
        setErrorMessage("Choose a completed goal to withdraw from.");
        return;
      }
      if (amount > selectedGoal.currentAmount) {
        setErrorMessage("This goal does not have enough saved money.");
        return;
      }
    }

    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiCreateChildWithdrawal({
        source: withdrawSource,
        amount,
        goalId: withdrawSource === "goal" ? withdrawGoalId : undefined,
        description: withdrawDescription.trim() || undefined,
      });
      setStatusMessage(data.message);
      setWallet(data.wallet);
      if (data.goal) {
        setSavingsGoals((prev) => prev.map((goal) => (goal.id === data.goal?.id ? data.goal : goal)));
      }
      setWithdrawAmount("");
      setWithdrawDescription("");
      setWithdrawGoalId("");
      setShowWithdrawForm(false);
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create withdrawal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteChore(choreId: string) {
    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiCompleteChildChore(choreId);
      setStatusMessage(data.message);
      setShowReward(true);
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not complete chore.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getLearningResourceUrl(resourceUrl: string | null) {
    if (!resourceUrl) return "";
    return resourceUrl.startsWith("http")
      ? resourceUrl
      : `${API_BASE_URL}${resourceUrl.startsWith("/") ? resourceUrl : `/${resourceUrl}`}`;
  }

  function applyLearningProgressUpdate(
    assignmentId: string,
    assignment: {
      status: string;
      progressPercent: number;
      firstViewedAt: string | null;
      lastViewedAt: string | null;
      completedAt: string | null;
    }
  ) {
    setAssignedLessons((current) =>
      current.map((lesson) =>
        lesson.assignmentId === assignmentId
          ? {
              ...lesson,
              status: assignment.status,
              progressPercent: assignment.progressPercent,
              firstViewedAt: assignment.firstViewedAt,
              lastViewedAt: assignment.lastViewedAt,
              completedAt: assignment.completedAt,
            }
          : lesson
      )
    );
  }

  async function updateLearningProgress(lesson: ChildLearningLesson, progressPercent: number) {
    clearMessages();
    try {
      const data = await apiUpdateChildLearningProgress(lesson.assignmentId, progressPercent);
      applyLearningProgressUpdate(lesson.assignmentId, data.assignment);
      setStatusMessage(data.message);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update lesson progress.");
    }
  }

  function openLearningResource(lesson: ChildLearningLesson) {
    const fullUrl = getLearningResourceUrl(lesson.resourceUrl);
    if (!fullUrl) {
      setStatusMessage(`${lesson.title} is ready to read on this page.`);
      return;
    }

    const browserRef = globalThis as unknown as { open?: (url: string, target?: string) => void };
    if (typeof browserRef.open === "function") {
      browserRef.open(fullUrl, "_blank");
      return;
    }

    setStatusMessage(`Open this learning link: ${fullUrl}`);
  }

  function downloadLearningResource(lesson: ChildLearningLesson) {
    const fullUrl = getLearningResourceUrl(lesson.resourceUrl);
    if (!fullUrl) {
      setStatusMessage("This lesson does not have a downloadable file.");
      return;
    }

    const documentRef = globalThis as unknown as {
      document?: {
        createElement?: (tagName: "a") => { href: string; download: string; target: string; click: () => void; remove: () => void };
        body?: { appendChild: (node: unknown) => void };
      };
    };
    const anchor = documentRef.document?.createElement?.("a");
    if (anchor && documentRef.document?.body) {
      anchor.href = fullUrl;
      anchor.download = lesson.fileName ?? lesson.title;
      anchor.target = "_blank";
      documentRef.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    openLearningResource(lesson);
  }

  function markLearningFinished(lesson: ChildLearningLesson) {
    void updateLearningProgress(lesson, 100);
  }

  async function handleChangePassword() {
    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiChangePassword({ currentPassword, newPassword, confirmPassword });
      setStatusMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={[styles.wrap, isMobile ? styles.wrapMobile : null]}>
      {!isMobile ? (
        <View style={styles.webSidebar}>
          <View style={styles.webBrandWrap}>
            <Text style={styles.webBrand}>KidsBank</Text>
          </View>
          <View style={styles.webNavList}>
            {webNavItems.map((item) => {
              const active = tab === item.key;
              return (
                <Pressable key={item.label} style={[styles.webNavItem, active ? styles.webNavItemActive : null]} onPress={() => setTab(item.key)}>
                  <View style={[styles.webNavIconPill, active ? styles.webNavIconPillActive : null]}>
                    <Text style={[styles.webNavIcon, active ? styles.webNavIconActive : null]}>{item.icon}</Text>
                  </View>
                  <Text style={[styles.webNavText, active ? styles.webNavTextActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.webLogoutBtn} onPress={onLogout}>
            <Text style={styles.webLogoutBtnText}>Log Out</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={[styles.contentCard, isMobile ? styles.contentCardMobile : null]}
        contentContainerStyle={[styles.contentCardInner, isMobile ? styles.contentCardInnerMobile : null]}
        showsVerticalScrollIndicator={false}
      >
        {!isMobile ? (
          <View pointerEvents="none" style={styles.webBgLayer}>
            <Image source={getTabBackgroundImage(tab)} style={styles.webBgArtMain} resizeMode="cover" />
          </View>
        ) : null}

        {isMobile ? (
          <View style={styles.mobileHeader}>
            <View style={styles.mobileProfileRow}>
              <View style={styles.mobileAvatar}>
                <Text style={styles.mobileAvatarText}>{username[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View>
                <Text style={styles.mobileUsername}>Hi, {username}!</Text>
                <Text style={styles.mobileHello}>Let's learn, save and grow!</Text>
              </View>
            </View>
            <Pressable style={styles.mobileBellBtn} onPress={() => setTab("settings")}>
              <Text style={styles.mobileBellIcon}>🔔</Text>
              <View style={styles.mobileBellBadge}>
                <Text style={styles.mobileBellBadgeText}>3</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webTopRow}>
            <View>
              <Text style={styles.webHello}>Hello, {username}!</Text>
              <Text style={styles.webHelloSub}>Let's learn, save and grow together!</Text>
            </View>
            <View style={styles.webTopActions}>
              <View style={styles.webSearch}><Text style={styles.webSearchText}>Search...</Text></View>
              <Pressable style={styles.webProfilePill} onPress={() => setTab("settings")}>
                <Text style={styles.webProfileName}>{username}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        {safeErrorMessage ? <Text style={styles.errorText}>{safeErrorMessage}</Text> : null}
        {isLoading ? <Text style={styles.infoText}>Loading dashboard...</Text> : null}
        {showReward ? (
          <Animated.View
            style={[
              styles.rewardBanner,
              {
                opacity: rewardAnim,
                transform: [
                  {
                    translateY: rewardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                  {
                    scale: rewardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.rewardText}>Awesome work! ⭐ Chore completed</Text>
          </Animated.View>
        ) : null}

        {!isLoading && wallet && tab === "home" && isMobile ? (
          <Animated.View
            style={[
              styles.sectionWrap,
              {
                opacity: homeEnterAnim,
                transform: [
                  {
                    translateY: homeEnterAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.mobileBalanceCard}>
              <Text style={styles.mobileBalanceLabel}>My Wallet Balance</Text>
              <Text style={styles.mobileBalanceAmount}>{formatMoney(displayBalance)}</Text>
              <Text style={styles.mobileBalanceMeta}>Available Balance</Text>
            </View>

            <View style={styles.mobileServicesGrid}>
              <AnimatedTileButton
                style={styles.mobileServiceItem}
                onPress={() => {
                  setTxType("earn");
                  setTab("actions");
                }}
              >
                <Text style={styles.mobileServiceIcon}>💼</Text>
                <Text style={styles.mobileServiceLabel}>Add Money</Text>
              </AnimatedTileButton>
              <AnimatedTileButton
                style={styles.mobileServiceItem}
                onPress={() => {
                  setTxType("earn");
                  setTxDescription("Money request");
                  setTab("actions");
                }}
              >
                <Text style={styles.mobileServiceIcon}>✈</Text>
                <Text style={styles.mobileServiceLabel}>Request Money</Text>
              </AnimatedTileButton>
              <AnimatedTileButton style={styles.mobileServiceItem} onPress={() => setTab("savings")}>
                <Text style={styles.mobileServiceIcon}>🎯</Text>
                <Text style={styles.mobileServiceLabel}>My Goals</Text>
              </AnimatedTileButton>
              <AnimatedTileButton style={styles.mobileServiceItem} onPress={() => setTab("chores")}>
                <Text style={styles.mobileServiceIcon}>📋</Text>
                <Text style={styles.mobileServiceLabel}>My Chores</Text>
              </AnimatedTileButton>
            </View>

            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>Today's Overview</Text>
              <Pressable onPress={() => setTab("transactions")}>
                <Text style={styles.mobileSectionLink}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.mobileRecentCard}>
              <View style={styles.mobileRecentRow}>
                <View style={styles.mobileRecentIconWrap}>
                  <Text style={styles.mobileRecentIcon}>🎁</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>Allowance Received</Text>
                  <Text style={styles.rowMeta}>{latestAllowance ? new Date(latestAllowance.availableOn).toLocaleDateString() : "Today"}</Text>
                </View>
                <Text style={[styles.mobileRecentAmount, styles.mobileAmountPositive]}>
                  + {formatMoney(latestAllowance?.amount ?? 0)}
                </Text>
              </View>
              <View style={styles.mobileRecentRow}>
                <View style={styles.mobileRecentIconWrap}>
                  <Text style={styles.mobileRecentIcon}>⭐</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>Chore Reward</Text>
                  <Text style={styles.rowMeta}>{completedChores} chores completed</Text>
                </View>
                <Text style={[styles.mobileRecentAmount, styles.mobileAmountPositive]}>+ UGX 5,000</Text>
              </View>
              <View style={[styles.mobileRecentRow, styles.mobileRecentRowLast]}>
                <View style={styles.mobileRecentIconWrap}>
                  <Text style={styles.mobileRecentIcon}>🕒</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>Pending Requests</Text>
                  <Text style={styles.rowMeta}>Needs approval</Text>
                </View>
                <Text style={styles.mobileRecentAmount}>{pendingChores}</Text>
              </View>
            </View>

            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>My Goals</Text>
              <Pressable onPress={() => setTab("savings")}>
                <Text style={styles.mobileSectionLink}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.mobileGoalCard}>
              <View style={styles.mobileGoalProgress}>
                <Text style={styles.mobileGoalProgressText}>
                  {featuredGoal
                    ? `${Math.min(100, Math.round((featuredGoal.currentAmount / featuredGoal.targetAmount) * 100))}%`
                    : "0%"}
                </Text>
              </View>
              <View style={styles.mobileGoalMain}>
                <Text style={styles.mobileGoalTitle}>{featuredGoal?.title ?? "New Goal"}</Text>
                <Text style={styles.mobileGoalMeta}>
                  {featuredGoal
                    ? `${formatMoney(featuredGoal.currentAmount)} of ${formatMoney(featuredGoal.targetAmount)}`
                    : "No active goal yet"}
                </Text>
                <View style={styles.mobileGoalTrack}>
                  <View
                    style={[
                      styles.mobileGoalTrackFill,
                      {
                        width: featuredGoal
                          ? `${Math.min(100, Math.round((featuredGoal.currentAmount / featuredGoal.targetAmount) * 100))}%`
                          : "4%",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.mobileGoalHint}>You're doing great!</Text>
              </View>
            </View>

            <View style={styles.mobileTipCard}>
              <Text style={styles.mobileTipTitle}>Quick Tip</Text>
              <Text style={styles.mobileTipText}>Saving a little today can help you achieve big dreams tomorrow!</Text>
            </View>
          </Animated.View>
        ) : null}

        {tab === "home" && !isMobile ? (
          <View style={styles.webGridWrap}>
            <View style={styles.webMainCol}>
              <View style={styles.webWalletHero}>
                <View style={styles.webHeroRow}>
                  <View style={styles.webHeroMain}>
                    <Text style={styles.webWalletTitle}>My Wallet</Text>
                    <Text style={styles.webWalletLabel}>Available Balance</Text>
                    <Text style={styles.webWalletValue}>{formatMoney(walletBalance)}</Text>
                  </View>
                  <Image source={walletIllustration1} style={styles.webHeroImage} resizeMode="contain" />
                </View>
                <View style={styles.webWalletStats}>
                  <Text style={styles.webWalletStat}>Pending {formatMoney(pendingTransactions * 5000)}</Text>
                  <Text style={styles.webWalletStat}>Total Savings {formatMoney(totalSavings)}</Text>
                  <Text style={styles.webWalletStat}>Total Earned {formatMoney(walletEarned)}</Text>
                </View>
              </View>

              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>My Active Goal</Text>
                <View style={styles.webRowBetween}>
                  <View>
                    <Text style={styles.rowMain}>{featuredGoal?.title ?? "New Bicycle"}</Text>
                    <Text style={styles.rowMeta}>
                      {featuredGoal ? `${formatMoney(featuredGoal.currentAmount)} of ${formatMoney(featuredGoal.targetAmount)}` : "Start your first goal"}
                    </Text>
                  </View>
                  <Text style={styles.webGoalPct}>{activeGoalProgress}%</Text>
                </View>
              </View>

              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Continue Learning</Text>
                <View style={styles.webRowBetween}>
                  <View>
                    <Text style={styles.rowMain}>Why Saving is Important</Text>
                    <Text style={styles.rowMeta}>Lesson 3 of 5</Text>
                  </View>
                  <Pressable style={styles.webMiniBtn} onPress={() => setTab("learn")}>
                    <Text style={styles.webMiniBtnText}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.webMidCol}>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Quick Actions</Text>
                <View style={styles.webQuickRow}>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("actions")}><Text style={styles.webQuickText}>Request Money</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("savings")}><Text style={styles.webQuickText}>My Goals</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("chores")}><Text style={styles.webQuickText}>My Chores</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("learn")}><Text style={styles.webQuickText}>Learn & Earn</Text></Pressable>
                </View>
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>My Chores</Text>
                {chores.slice(0, 3).map((chore) => (
                  <View key={chore.id} style={styles.rowItem}>
                    <Text style={styles.rowMain}>{chore.title}</Text>
                    <Text style={styles.rowMeta}>{chore.status}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Recent Notifications</Text>
                {transactions.slice(0, 3).map((tx) => (
                  <View key={tx.id} style={styles.rowItemColumn}>
                    <Text style={styles.rowMeta}>
                      {tx.type === "spend" ? "Your withdrawal request was processed." : "You received a wallet credit."}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.webRightCol}>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Daily Tip</Text>
                <Image source={walletIllustration2} style={styles.webSideImage} resizeMode="contain" />
                <Text style={styles.rowMeta}>Saving a little every day helps you achieve big dreams!</Text>
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Allowance</Text>
                <Text style={styles.webAllowanceValue}>2 Days</Text>
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Recent Achievement</Text>
                <Image source={walletIllustration3} style={styles.webSideImageSmall} resizeMode="contain" />
                <Text style={styles.rowMeta}>You earned the "Saving Star" badge!</Text>
              </View>
            </View>
          </View>
        ) : null}

        {!isLoading && wallet && tab === "learn" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileLearnHeaderRow}>
              <View>
                <Text style={styles.mobileLearnTitle}>Learn & Earn</Text>
                <Text style={styles.mobileLearnSubtitle}>Learn smart money skills and earn badges!</Text>
              </View>
              <View style={styles.mobileCoinsPill}>
                <Text style={styles.mobileCoinsValue}>{Math.max(120, completedChores * 20)}</Text>
                <Text style={styles.mobileCoinsLabel}>Coins Earned</Text>
              </View>
            </View>

            <View style={styles.mobileLearnHero}>
              <Text style={styles.mobileLearnHeroTitle}>Keep learning,{`\n`}keep growing!</Text>
              <Text style={styles.mobileLearnHeroLabel}>Your Progress</Text>
              <View style={styles.mobileGoalTrack}>
                <View style={[styles.mobileGoalTrackFill, { width: `${learningProgressPercent}%` }]} />
              </View>
              <Text style={styles.mobileLearnHeroPercent}>{learningProgressPercent}%</Text>
            </View>

            <View style={styles.mobileLearnTabs}>
              <Text style={styles.mobileLearnTabActive}>All Lessons</Text>
              <Text style={styles.mobileLearnTab}>In Progress</Text>
              <Text style={styles.mobileLearnTab}>Completed</Text>
              <Text style={styles.mobileLearnTab}>Quizzes</Text>
            </View>

            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Continue Learning</Text>
              <View style={styles.mobileContinueCard}>
                <View style={styles.mobileContinueIcon}>
                  <Text style={styles.mobileContinueIconText}>{learningLessons[0]?.resourceType === "video" ? "V" : learningLessons[0]?.resourceType === "pdf" ? "P" : "R"}</Text>
                </View>
                <View style={styles.mobileContinueMain}>
                  <Text style={styles.mobileGoalTitle}>{learningLessons[0]?.title ?? "No lessons yet"}</Text>
                  <Text style={styles.rowMeta}>{learningLessons[0]?.subtitle ?? "Parent approved lessons will appear here."}</Text>
                  <Text style={styles.rowMeta} numberOfLines={3}>
                    {learningLessons[0]?.content ?? "Ask your parent to approve a lesson or video for you."}
                  </Text>
                  {learningLessons[0] ? (
                    <View style={styles.learningActionRow}>
                      <Pressable style={styles.learningActionBtnPrimary} onPress={() => openLearningResource(learningLessons[0])}>
                        <Text style={styles.learningActionBtnPrimaryText}>{learningLessons[0].resourceLabel}</Text>
                      </Pressable>
                      <View style={styles.learningSecondaryActionStack}>
                        {learningLessons[0].resourceUrl ? (
                          <Pressable style={styles.learningActionBtn} onPress={() => downloadLearningResource(learningLessons[0])}>
                            <Text style={styles.learningActionBtnText}>Download</Text>
                          </Pressable>
                        ) : null}
                        {learningLessons[0].progress < 100 ? (
                          <Pressable style={styles.learningActionBtn} onPress={() => markLearningFinished(learningLessons[0])}>
                            <Text style={styles.learningActionBtnText}>Finish</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.mobileContinueFooter}>
                    <View style={[styles.mobileGoalTrack, styles.mobileContinueTrack]}>
                      <View style={[styles.mobileGoalTrackFill, { width: `${learningLessons[0]?.progress ?? 0}%` }]} />
                    </View>
                    <Text style={styles.mobileGoalHint}>{learningLessons[0]?.progress ?? 0}%</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Parent Approved Lessons</Text>
              {learningLessons.slice(0, 5).map((lesson, index) => (
                <View key={lesson.id} style={[styles.mobileLessonRow, index === learningLessons.slice(0, 5).length - 1 ? styles.mobileRecentRowLast : null]}>
                  <View style={styles.mobileLessonIconWrap}>
                    <Text style={styles.mobileLessonIcon}>{lesson.resourceType === "video" ? "V" : lesson.resourceType === "pdf" ? "P" : "R"}</Text>
                  </View>
                  <View style={styles.mobileContinueMain}>
                    <Text style={styles.rowMain}>{lesson.title}</Text>
                    <Text style={styles.rowMeta}>{lesson.subtitle}</Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>{lesson.content}</Text>
                    <View style={styles.learningActionRow}>
                      <Pressable style={styles.learningActionBtnPrimary} onPress={() => openLearningResource(lesson)}>
                        <Text style={styles.learningActionBtnPrimaryText}>{lesson.resourceLabel}</Text>
                      </Pressable>
                      <View style={styles.learningSecondaryActionStack}>
                        {lesson.resourceUrl ? (
                          <Pressable style={styles.learningActionBtn} onPress={() => downloadLearningResource(lesson)}>
                            <Text style={styles.learningActionBtnText}>Download</Text>
                          </Pressable>
                        ) : null}
                        {lesson.progress < 100 ? (
                          <Pressable style={styles.learningActionBtn} onPress={() => markLearningFinished(lesson)}>
                            <Text style={styles.learningActionBtnText}>Finish</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.mobileGoalTrack}>
                      <View style={[styles.mobileGoalTrackFill, { width: `${lesson.progress}%` }]} />
                    </View>
                    <Text style={styles.mobileGoalHint}>{lesson.progress}% complete</Text>
                  </View>
                  <Text style={lesson.statusLabel === "Completed" ? styles.tableCellSuccess : styles.tableCellPending}>
                    {lesson.statusLabel}
                  </Text>
                </View>
              ))}
              {learningLessons.length === 0 ? (
                <Text style={styles.rowMeta}>Lessons and videos approved by your parent will appear here.</Text>
              ) : null}
            </View>

            <View style={styles.mobileTipCard}>
              <Text style={styles.mobileTipTitle}>Complete lessons and quizzes</Text>
              <Text style={styles.mobileTipText}>Earn coins and unlock awesome rewards!</Text>
            </View>
          </View>
        ) : null}

        {tab === "wallet" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webWalletTopGrid}>
              <View style={styles.webWalletHero}>
                <Text style={styles.webWalletTitle}>Total Balance</Text>
                <View style={styles.webHeroRow}>
                  <View style={styles.webHeroMain}>
                    <Text style={styles.webWalletValue}>{formatMoney(walletBalance)}</Text>
                  </View>
                  <Image source={walletIllustration4} style={styles.webHeroImage} resizeMode="contain" />
                </View>
                <View style={styles.webWalletStats}>
                  <Text style={styles.webWalletStat}>Available {formatMoney(Math.max(0, walletBalance - pendingTransactions * 5000))}</Text>
                  <Text style={styles.webWalletStat}>Pending {formatMoney(pendingTransactions * 5000)}</Text>
                </View>
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Balance Trend</Text>
                <View style={styles.webTrendChart}>
                  {[20, 30, 28, 45, 48, 60, 54, 68, 62, 70].map((v, i) => (
                    <View key={`${v}-${i}`} style={[styles.webTrendPoint, { left: 12 + i * 28, bottom: v }]} />
                  ))}
                </View>
                <View style={styles.webRowBetween}>
                  <Text style={styles.tableCellSuccess}>Money In {formatMoney(walletEarned)}</Text>
                  <Text style={styles.tableCellPending}>Money Out {formatMoney(walletSpent)}</Text>
                </View>
              </View>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>Balance Breakdown</Text>
                <Text style={styles.rowMeta}>Available {formatMoney(Math.max(0, walletBalance - pendingTransactions * 5000))}</Text>
                <Text style={styles.rowMeta}>Pending {formatMoney(pendingTransactions * 5000)}</Text>
                <Text style={styles.rowMeta}>Savings Lock {formatMoney(totalSavings)}</Text>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webCard}>
                <View style={styles.webRowBetween}>
                  <Text style={styles.webCardTitle}>Recent Transactions</Text>
                  <Pressable onPress={() => setTab("transactions")}>
                    <Text style={styles.mobileSectionLink}>View All</Text>
                  </Pressable>
                </View>
                <View style={styles.webTxHeader}>
                  <Text style={styles.webTxHeadCell}>Date</Text>
                  <Text style={styles.webTxHeadCell}>Description</Text>
                  <Text style={styles.webTxHeadCell}>Type</Text>
                  <Text style={styles.webTxHeadCell}>Amount</Text>
                  <Text style={styles.webTxHeadCell}>Status</Text>
                </View>
                {transactions.slice(0, 5).map((tx) => (
                  <View key={tx.id} style={styles.webTxRow}>
                    <Text style={styles.webTxCell}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                    <Text style={styles.webTxCell}>{tx.description || (tx.type === "earn" ? "Allowance" : "Wallet expense")}</Text>
                    <Text style={styles.webTxCell}>{tx.type === "earn" ? "Money In" : "Money Out"}</Text>
                    <Text style={[styles.webTxCell, tx.type === "earn" ? styles.tableCellSuccess : styles.tableCellPending]}>
                      {tx.type === "earn" ? "+" : "-"} {formatMoney(tx.amount)}
                    </Text>
                    <Text style={tx.status === "approved" ? styles.tableCellSuccess : tx.status === "pending" ? styles.tableCellPending : styles.rowMeta}>
                      {tx.status}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.webWalletRightCol}>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>Withdraw Money</Text>
                    <Pressable style={styles.webMiniBtn} onPress={() => setShowWithdrawForm((prev) => !prev)}>
                      <Text style={styles.webMiniBtnText}>{showWithdrawForm ? "Close" : "Withdraw"}</Text>
                    </Pressable>
                  </View>
                  {showWithdrawForm ? (
                    <View style={styles.withdrawForm}>
                      <Text style={styles.rowMeta}>Where do you want to withdraw from?</Text>
                      <View style={styles.choiceRow}>
                        <Pressable
                          style={[styles.choicePill, withdrawSource === "wallet" ? styles.choicePillActive : null]}
                          onPress={() => setWithdrawSource("wallet")}
                        >
                          <Text style={[styles.choiceText, withdrawSource === "wallet" ? styles.choiceTextActive : null]}>My Account</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.choicePill, withdrawSource === "goal" ? styles.choicePillActive : null]}
                          onPress={() => {
                            setWithdrawSource("goal");
                            if (!withdrawGoalId && withdrawableCompletedGoals[0]) setWithdrawGoalId(withdrawableCompletedGoals[0].id);
                          }}
                        >
                          <Text style={[styles.choiceText, withdrawSource === "goal" ? styles.choiceTextActive : null]}>Completed Goal</Text>
                        </Pressable>
                      </View>
                      {withdrawSource === "goal" ? (
                        <View style={styles.withdrawGoalList}>
                          {withdrawableCompletedGoals.map((goal) => (
                            <Pressable
                              key={goal.id}
                              style={[styles.withdrawGoalOption, withdrawGoalId === goal.id ? styles.withdrawGoalOptionActive : null]}
                              onPress={() => {
                                setWithdrawGoalId(goal.id);
                                setWithdrawAmount(String(Math.round(goal.currentAmount)));
                              }}
                            >
                              <Text style={styles.rowMain}>{goal.title}</Text>
                              <Text style={styles.rowMeta}>{formatMoney(goal.currentAmount)} saved</Text>
                            </Pressable>
                          ))}
                          {withdrawableCompletedGoals.length === 0 ? (
                            <Text style={styles.rowMeta}>No completed goals have money left to withdraw.</Text>
                          ) : null}
                        </View>
                      ) : null}
                      <AppInput
                        label="Amount (UGX)"
                        value={withdrawAmount}
                        onChangeText={setWithdrawAmount}
                        keyboardType="numeric"
                        placeholder="10000"
                      />
                      <AppInput
                        label="Reason"
                        value={withdrawDescription}
                        onChangeText={setWithdrawDescription}
                        placeholder="Optional"
                      />
                      <AppButton title="Submit Withdrawal" loading={isSubmitting} onPress={handleCreateWithdrawal} />
                    </View>
                  ) : (
                    <Text style={styles.rowMeta}>Withdraw from your account, or from a completed savings goal.</Text>
                  )}
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Want to save more?</Text>
                  <Text style={styles.rowMeta}>Create a savings goal and watch your money grow.</Text>
                  <Pressable style={styles.webMiniBtn} onPress={() => setTab("savings")}>
                    <Text style={styles.webMiniBtnText}>Create a Goal</Text>
                  </Pressable>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Smart Money Tip</Text>
                  <Image source={walletIllustration5} style={styles.webSideImage} resizeMode="contain" />
                  <Text style={styles.rowMeta}>Save a little today for something you'll love tomorrow!</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "learn" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>Learn & Earn</Text>
                <Text style={styles.webHelloSub}>Learn smart money skills and earn coins!</Text>
              </View>
              <View style={styles.webTopActions}>
                <View style={styles.webSearch}><Text style={styles.webSearchText}>Search lessons...</Text></View>
              </View>
            </View>

            <View style={styles.webGoalsTopGrid}>
              <View style={styles.webGoalsBanner}>
                <Text style={styles.webGoalsBannerText}>Keep learning, keep growing! Every lesson makes you smarter.</Text>
              </View>
              <View style={styles.webGoalsKpiRow}>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Coins Earned</Text><Text style={styles.webKpiValue}>{Math.max(120, completedChores * 20)}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Approved Lessons</Text><Text style={styles.webKpiValue}>{learningLessons.length}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Lessons Completed</Text><Text style={styles.webKpiValue}>{completedLearningCount}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Progress</Text><Text style={styles.webKpiValue}>{learningProgressPercent}%</Text></View>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webCard}>
                <View style={styles.webRowBetween}>
                  <Text style={styles.webCardTitle}>Parent Approved Lessons</Text>
                  <View style={styles.webQuickRow}>
                    <Text style={styles.mobileSectionLink}>All Lessons</Text>
                    <Text style={styles.rowMeta}>In Progress</Text>
                    <Text style={styles.rowMeta}>Completed</Text>
                  </View>
                </View>
                <View style={styles.webGoalsGrid}>
                  {learningLessons.slice(0, 8).map((lesson) => (
                    <View key={lesson.id} style={styles.webGoalTile}>
                      <Text style={styles.rowMain}>{lesson.title}</Text>
                      <Text style={styles.rowMeta}>{lesson.subtitle}</Text>
                      <Text style={styles.rowMeta} numberOfLines={3}>{lesson.content}</Text>
                      <View style={styles.mobileGoalTrack}>
                        <View style={[styles.mobileGoalTrackFill, { width: `${lesson.progress}%` }]} />
                      </View>
                      <Text style={lesson.statusLabel === "Completed" ? styles.tableCellSuccess : styles.tableCellPending}>
                        {lesson.statusLabel}
                      </Text>
                      <View style={styles.learningActionRow}>
                        <Pressable style={styles.learningActionBtnPrimary} onPress={() => openLearningResource(lesson)}>
                          <Text style={styles.learningActionBtnPrimaryText}>{lesson.resourceLabel}</Text>
                        </Pressable>
                        <View style={styles.learningSecondaryActionStack}>
                          {lesson.resourceUrl ? (
                            <Pressable style={styles.learningActionBtn} onPress={() => downloadLearningResource(lesson)}>
                              <Text style={styles.learningActionBtnText}>Download</Text>
                            </Pressable>
                          ) : null}
                          {lesson.progress < 100 ? (
                            <Pressable style={styles.learningActionBtn} onPress={() => markLearningFinished(lesson)}>
                              <Text style={styles.learningActionBtnText}>Finish</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))}
                  {learningLessons.length === 0 ? (
                    <View style={styles.mobileGoalEmptyCard}>
                      <Text style={styles.mobileGoalEmptyTitle}>No lessons approved yet</Text>
                      <Text style={styles.mobileGoalEmptyText}>Lessons, PDFs, and videos your parent approves will appear here for viewing and download.</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.webWalletRightCol}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Your Progress</Text>
                  <Text style={styles.webAllowanceValue}>{learningProgressPercent}%</Text>
                  <Text style={styles.rowMeta}>overall progress</Text>
                </View>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>Badges</Text>
                    <Text style={styles.mobileSectionLink}>View All</Text>
                  </View>
                  <Text style={styles.rowMeta}>Saver, Learner, Explorer</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Top Learners</Text>
                  <Text style={styles.rowMeta}>1. Noah - 215</Text>
                  <Text style={styles.rowMeta}>2. Amina (You) - 120</Text>
                  <Text style={styles.rowMeta}>3. Ethan - 95</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "transactions" && isMobile ? (
          <View style={[styles.softCard, styles.softCardMobile]}>
            <Text style={styles.cardTitle}>Transactions</Text>
            {transactions.map((tx) => (
              <View key={tx.id} style={[styles.rowItem, styles.rowItemMobile]}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>{tx.type.toUpperCase()} - {formatMoney(tx.amount)}</Text>
                  <Text style={styles.rowMeta}>{tx.description ?? "No description"}</Text>
                </View>
                <Text style={[styles.rowMeta, styles.rowMetaRightMobile]}>{tx.status}</Text>
              </View>
            ))}
            {transactions.length === 0 ? <Text style={styles.infoText}>No transactions yet.</Text> : null}
          </View>
        ) : null}

        {!isLoading && tab === "transactions" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>Transactions</Text>
                <Text style={styles.webHelloSub}>Track your money and celebrate your progress!</Text>
              </View>
              <View style={styles.webTopActions}>
                <View style={styles.webSearch}><Text style={styles.webSearchText}>Search transactions...</Text></View>
              </View>
            </View>

            <View style={styles.webGoalsKpiRow}>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Money In</Text><Text style={styles.tableCellSuccess}>{formatMoney(totalMoneyIn)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Money Out</Text><Text style={styles.tableCellPending}>{formatMoney(totalMoneyOut)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Net Balance</Text><Text style={styles.webKpiValue}>{formatMoney(netBalance)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Total Transactions</Text><Text style={styles.webKpiValue}>{transactions.length}</Text></View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webCard}>
                <View style={styles.webRowBetween}>
                  <View style={styles.webQuickRow}>
                    <Text style={styles.mobileSectionLink}>All</Text>
                    <Text style={styles.rowMeta}>Money In</Text>
                    <Text style={styles.rowMeta}>Money Out</Text>
                    <Text style={styles.rowMeta}>Pending</Text>
                  </View>
                  <Text style={styles.rowMeta}>This Month</Text>
                </View>
                <View style={styles.webTxHeader}>
                  <Text style={styles.webTxHeadCell}>Date</Text>
                  <Text style={styles.webTxHeadCell}>Description</Text>
                  <Text style={styles.webTxHeadCell}>Type</Text>
                  <Text style={styles.webTxHeadCell}>Amount</Text>
                  <Text style={styles.webTxHeadCell}>Status</Text>
                  <Text style={styles.webTxHeadCell}>Balance</Text>
                </View>
                {transactions.slice(0, 8).map((tx) => (
                  <View key={tx.id} style={styles.webTxRow}>
                    <Text style={styles.webTxCell}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                    <Text style={styles.webTxCell}>{tx.description || (tx.type === "earn" ? "Weekly Allowance" : "Saved to Goal")}</Text>
                    <Text style={styles.webTxCell}>{tx.type === "earn" ? "Money In" : "Money Out"}</Text>
                    <Text style={[styles.webTxCell, tx.type === "earn" ? styles.tableCellSuccess : styles.tableCellPending]}>
                      {tx.type === "earn" ? "+" : "-"} {formatMoney(tx.amount)}
                    </Text>
                    <Text style={tx.status === "approved" ? styles.tableCellSuccess : tx.status === "pending" ? styles.tableCellPending : styles.rowMeta}>
                      {tx.status}
                    </Text>
                    <Text style={styles.webTxCell}>{formatMoney(walletBalance)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.webWalletRightCol}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Spending vs Saving</Text>
                  <Text style={styles.rowMeta}>Spent {formatMoney(totalMoneyOut)} ({totalMoneyIn + totalMoneyOut > 0 ? Math.round((totalMoneyOut / (totalMoneyIn + totalMoneyOut)) * 100) : 0}%)</Text>
                  <Text style={styles.rowMeta}>Saved {formatMoney(totalMoneyIn)} ({totalMoneyIn + totalMoneyOut > 0 ? Math.round((totalMoneyIn / (totalMoneyIn + totalMoneyOut)) * 100) : 0}%)</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Transaction Breakdown</Text>
                  <Text style={styles.rowMeta}>Allowance {formatMoney(Math.round(totalMoneyIn * 0.4))}</Text>
                  <Text style={styles.rowMeta}>Chore Rewards {formatMoney(Math.round(totalMoneyIn * 0.2))}</Text>
                  <Text style={styles.rowMeta}>Goal Savings {formatMoney(Math.round(totalMoneyOut * 0.5))}</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Smart Money Tip</Text>
                  <Text style={styles.rowMeta}>Tracking your money helps you make better choices and reach your goals faster!</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "notifications" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>Notifications</Text>
                <Text style={styles.webHelloSub}>Stay updated on your wallet, chores, and goals.</Text>
              </View>
            </View>
            <View style={styles.webCard}>
              {transactions.slice(0, 8).map((tx) => (
                <View key={tx.id} style={styles.webProfileRow}>
                  <View>
                    <Text style={styles.rowMain}>
                      {tx.type === "earn" ? "Money added to your wallet" : "Money spent from your wallet"}
                    </Text>
                    <Text style={styles.rowMeta}>{tx.description || "Transaction update"}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
                </View>
              ))}
              {transactions.length === 0 ? <Text style={styles.infoText}>No notifications yet.</Text> : null}
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "savings" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>My Goals</Text>
              <Pressable onPress={() => setTab("actions")}>
                <Text style={styles.mobileSectionLink}>Add Goal</Text>
              </Pressable>
            </View>
            {activeSavingsGoals.length === 0 ? (
              <View style={styles.mobileGoalEmptyCard}>
                <Text style={styles.mobileGoalEmptyTitle}>{completedSavingsGoals.length > 0 ? "All caught up!" : "No goals yet"}</Text>
                <Text style={styles.mobileGoalEmptyText}>
                  {completedSavingsGoals.length > 0
                    ? "Your completed goals have moved into achievements."
                    : "Start a new savings goal and track your progress daily."}
                </Text>
                <AppButton title="Create Goal" onPress={() => setTab("actions")} />
              </View>
            ) : null}
            {activeSavingsGoals.map((goal) => {
              const progress = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
              const safeProgress = Math.min(100, Math.max(0, progress));
              return (
                <View key={goal.id} style={styles.mobileGoalCard}>
                  <View style={styles.mobileGoalProgress}>
                    <Text style={styles.mobileGoalProgressText}>{safeProgress}%</Text>
                  </View>
                  <View style={styles.mobileGoalMain}>
                    <Text style={styles.mobileGoalTitle}>{goal.title}</Text>
                    <Text style={styles.mobileGoalMeta}>
                      {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}
                    </Text>
                    <View style={styles.mobileGoalTrack}>
                      <View style={[styles.mobileGoalTrackFill, { width: `${safeProgress}%` }]} />
                    </View>
                    <Text style={styles.mobileGoalHint}>
                      {safeProgress >= 100 ? "Goal complete. Great job!" : "Keep going, you are doing great!"}
                    </Text>
                    <AppInput
                      label="Amount to add (UGX)"
                      value={fundGoalAmounts[goal.id] ?? ""}
                      onChangeText={(value) =>
                        setFundGoalAmounts((prev) => ({
                          ...prev,
                          [goal.id]: value,
                        }))
                      }
                      keyboardType="numeric"
                    />
                    <AppButton
                      title="Fund Goal"
                      loading={isSubmitting && fundingGoalId === goal.id}
                      onPress={() => handleFundGoal(goal.id)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!isLoading && tab === "savings" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>My Goals</Text>
                <Text style={styles.webHelloSub}>Save today, achieve tomorrow!</Text>
              </View>
              <View style={styles.webTopActions}>
                <View style={styles.webSearch}><Text style={styles.webSearchText}>Search goals...</Text></View>
                <Pressable style={styles.webMiniBtn} onPress={() => setTab("actions")}>
                  <Text style={styles.webMiniBtnText}>Create New Goal</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.webGoalsTopGrid}>
              <View style={styles.webGoalsBanner}>
                <Text style={styles.webGoalsBannerText}>Every coin you save brings you closer to your dreams!</Text>
              </View>
              <View style={styles.webGoalsKpiRow}>
                <View style={styles.webGoalsKpiCard}>
                  <Text style={styles.webKpiLabel}>Total Goals</Text>
                  <Text style={styles.webKpiValue}>{savingsGoals.length}</Text>
                </View>
                <View style={styles.webGoalsKpiCard}>
                  <Text style={styles.webKpiLabel}>Total Saved</Text>
                  <Text style={styles.webKpiValue}>{formatMoney(totalSavings)}</Text>
                </View>
                <View style={styles.webGoalsKpiCard}>
                  <Text style={styles.webKpiLabel}>Goal Progress</Text>
                  <Text style={styles.webKpiValue}>{avgGoalProgress}%</Text>
                </View>
                <View style={styles.webGoalsKpiCard}>
                  <Text style={styles.webKpiLabel}>Goals Achieved</Text>
                  <Text style={styles.webKpiValue}>{completedGoalsCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={[styles.webCard, styles.activeGoalsCard]}>
                <View style={styles.webRowBetween}>
                  <Text style={styles.webCardTitle}>My Active Goals</Text>
                  <Text style={styles.mobileSectionLink}>View All Goals</Text>
                </View>
                <View style={styles.webGoalsGrid}>
                  {activeSavingsGoals.slice(0, 4).map((goal) => {
                    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                    return (
                      <View key={goal.id} style={styles.webGoalTile}>
                        <Text style={styles.rowMain}>{goal.title}</Text>
                        <Text style={styles.rowMeta}>{formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}</Text>
                        <View style={styles.mobileGoalTrack}>
                          <View style={[styles.mobileGoalTrackFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.mobileGoalHint}>{progress}%</Text>
                        <View style={styles.webFundRow}>
                          <AppInput
                            label="Amount (UGX)"
                            value={fundGoalAmounts[goal.id] ?? ""}
                            onChangeText={(value) =>
                              setFundGoalAmounts((prev) => ({
                                ...prev,
                                [goal.id]: value,
                              }))
                            }
                            keyboardType="numeric"
                          />
                          <AppButton
                            title="Fund Goal"
                            loading={isSubmitting && fundingGoalId === goal.id}
                            onPress={() => handleFundGoal(goal.id)}
                          />
                        </View>
                      </View>
                    );
                  })}
                  {activeSavingsGoals.length === 0 ? <Text style={styles.infoText}>No active goals yet. Completed goals are now shown below.</Text> : null}
                </View>
              </View>
              <View style={styles.savingsArchiveArea}>
                <View style={styles.savingsInfoStack}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Savings Streak</Text>
                  <Text style={styles.webAllowanceValue}>7</Text>
                  <Text style={styles.rowMeta}>days in a row</Text>
                </View>
                <View style={[styles.webCard, styles.achievementCard]}>
                  <Text style={styles.webCardTitle}>Goal Achievement</Text>
                  <Text style={styles.achievementIcon}>{goldenStarCount > 0 ? "★" : "◎"}</Text>
                  <Text style={styles.rowMain}>
                    {goldenStarCount > 0 ? `${goldenStarCount} golden star${goldenStarCount === 1 ? "" : "s"} earned` : "Complete a goal to earn a star"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {goldenStarCount > 0 ? "Each completed goal gives you an automatic golden star." : "Your first golden coin is waiting."}
                  </Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Did You Know?</Text>
                  <Text style={styles.rowMeta}>People who set goals are much more likely to achieve them.</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Goal Tip</Text>
                  <Text style={styles.rowMeta}>Break big goals into smaller steps. Small savings, big dreams!</Text>
                </View>
                </View>
                <View style={[styles.webCard, styles.completedGoalsArchiveCard]}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>Completed Goals</Text>
                    <Text style={styles.mobileSectionLink}>Archived</Text>
                  </View>
                  <View style={styles.completedGoalsArchiveGrid}>
                    {completedSavingsGoals.map((goal) => (
                      <View key={goal.id} style={styles.completedGoalMiniCard}>
                        <Text style={styles.rowMain}>{goal.title}</Text>
                        <Text style={styles.tableCellSuccess}>{formatMoney(goal.currentAmount)}</Text>
                        <Text style={styles.rowMeta}>Golden star earned</Text>
                      </View>
                    ))}
                  </View>
                  {completedSavingsGoals.length === 0 ? (
                    <Text style={styles.rowMeta}>Complete a goal to archive it here.</Text>
                  ) : null}
                  <View style={styles.webGoalTileCta}>
                    <Text style={styles.webCardTitle}>What's your next goal?</Text>
                    <Pressable style={styles.webMiniBtn} onPress={() => setTab("actions")}>
                      <Text style={styles.webMiniBtnText}>Create New Goal</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

          </View>
        ) : null}

        {!isLoading && tab === "chores" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileLearnHeaderRow}>
              <View>
                <Text style={styles.mobileLearnTitle}>My Chores</Text>
                <Text style={styles.mobileLearnSubtitle}>Complete chores, earn rewards!</Text>
              </View>
              <View style={styles.mobileCoinsPill}>
                <Text style={styles.mobileCoinsValue}>{formatMoney(totalChoreRewards)}</Text>
                <Text style={styles.mobileCoinsLabel}>Total Earned</Text>
              </View>
            </View>

            <View style={styles.mobileChoreTabs}>
              <View style={[styles.mobileChoreTab, styles.mobileChoreTabActive]}>
                <Text style={[styles.mobileChoreTabText, styles.mobileChoreTabTextActive]}>To Do ({pendingChores})</Text>
              </View>
              <View style={styles.mobileChoreTab}>
                <Text style={styles.mobileChoreTabText}>Completed ({completedChores})</Text>
              </View>
            </View>

            <View style={styles.mobileTipCard}>
              <Text style={styles.mobileTipTitle}>Great job! Keep completing chores</Text>
              <Text style={styles.mobileTipText}>to earn more rewards.</Text>
            </View>

            <Text style={styles.cardTitle}>To Do</Text>
            <View style={styles.softCard}>
              {chores.filter((chore) => chore.status === "assigned").map((chore) => (
                <View key={chore.id} style={styles.mobileChoreRow}>
                  <View style={styles.mobileLessonIconWrap}>
                    <Text style={styles.mobileLessonIcon}>🛏️</Text>
                  </View>
                  <View style={styles.mobileContinueMain}>
                    <Text style={styles.rowMain}>{chore.title}</Text>
                    <Text style={styles.rowMeta}>{chore.description ?? "Complete this task and earn rewards."}</Text>
                    <Text style={styles.mobileAmountPositive}>🪙 {formatMoney(chore.rewardAmount)}</Text>
                  </View>
                  <View style={styles.mobileChoreActions}>
                    <Text style={styles.mobileDueTag}>{chore.dueDate ? "Due today" : "No due date"}</Text>
                    <Pressable style={styles.mobileMarkDoneBtn} onPress={() => handleCompleteChore(chore.id)}>
                      <Text style={styles.mobileMarkDoneText}>{isSubmitting ? "..." : "Mark Done"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {chores.filter((chore) => chore.status === "assigned").length === 0 ? (
                <Text style={styles.infoText}>No pending chores.</Text>
              ) : null}
            </View>

            <Text style={styles.cardTitle}>Completed</Text>
            <View style={styles.softCard}>
              {chores.filter((chore) => chore.status === "completed").map((chore) => (
                <View key={chore.id} style={styles.mobileChoreRow}>
                  <View style={styles.mobileLessonIconWrap}>
                    <Text style={styles.mobileLessonIcon}>✅</Text>
                  </View>
                  <View style={styles.mobileContinueMain}>
                    <Text style={styles.rowMain}>{chore.title}</Text>
                    <Text style={styles.rowMeta}>{chore.description ?? "Completed chore"}</Text>
                    <Text style={styles.mobileAmountPositive}>🪙 {formatMoney(chore.rewardAmount)}</Text>
                  </View>
                  <View style={styles.mobileChoreActions}>
                    <Text style={styles.tableCellSuccess}>Completed</Text>
                    <Text style={styles.rowMeta}>{chore.completedAt ? new Date(chore.completedAt).toLocaleDateString() : ""}</Text>
                  </View>
                </View>
              ))}
              {chores.filter((chore) => chore.status === "completed").length === 0 ? (
                <Text style={styles.infoText}>No completed chores yet.</Text>
              ) : null}
            </View>

            <View style={styles.mobileTipCard}>
              <Text style={styles.mobileTipTitle}>Complete chores to earn rewards</Text>
              <Text style={styles.mobileTipText}>Your effort leads to your goals!</Text>
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "chores" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>My Chores</Text>
                <Text style={styles.webHelloSub}>Complete chores, earn rewards, and grow!</Text>
              </View>
              <View style={styles.webTopActions}>
                <View style={styles.webSearch}><Text style={styles.webSearchText}>Search chores...</Text></View>
              </View>
            </View>

            <View style={styles.webGoalsTopGrid}>
              <View style={styles.webGoalsBanner}>
                <Text style={styles.webGoalsBannerText}>You can do it! Every chore helps you earn and learn!</Text>
              </View>
              <View style={styles.webGoalsKpiRow}>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Total Chores</Text><Text style={styles.webKpiValue}>{chores.length}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Total Earned</Text><Text style={styles.webKpiValue}>{formatMoney(totalChoreRewards)}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Completed</Text><Text style={styles.webKpiValue}>{completedChores}</Text></View>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Pending Approval</Text><Text style={styles.webKpiValue}>{pendingChores}</Text></View>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webCard}>
                <Text style={styles.webCardTitle}>To Do ({pendingChores})</Text>
                <View style={styles.webTxHeader}>
                  <Text style={styles.webTxHeadCell}>Chore</Text>
                  <Text style={styles.webTxHeadCell}>Reward</Text>
                  <Text style={styles.webTxHeadCell}>Due Date</Text>
                  <Text style={styles.webTxHeadCell}>Action</Text>
                </View>
                {chores.filter((c) => c.status === "assigned").map((chore) => (
                  <View key={chore.id} style={styles.webTxRow}>
                    <Text style={styles.webTxCell}>{chore.title}</Text>
                    <Text style={styles.webTxCell}>{formatMoney(chore.rewardAmount)}</Text>
                    <Text style={styles.webTxCell}>{chore.dueDate ? new Date(chore.dueDate).toLocaleDateString() : "Today"}</Text>
                    <Pressable style={styles.webDoneBtn} onPress={() => handleCompleteChore(chore.id)}>
                      <Text style={styles.webDoneBtnText}>Mark Done</Text>
                    </Pressable>
                  </View>
                ))}
                {chores.filter((c) => c.status === "assigned").length === 0 ? <Text style={styles.infoText}>No pending chores.</Text> : null}
              </View>

              <View style={styles.webWalletRightCol}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Earnings This Week</Text>
                  <Text style={styles.webAllowanceValue}>{formatMoney(totalChoreRewards)}</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Pending Approval</Text>
                  {chores.filter((c) => c.status === "assigned").slice(0, 2).map((c) => (
                    <Text key={c.id} style={styles.rowMeta}>{c.title} - Pending</Text>
                  ))}
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Chore Tip</Text>
                  <Text style={styles.rowMeta}>Doing little things every day makes a BIG difference!</Text>
                </View>
              </View>
            </View>

            <View style={styles.webCard}>
              <Text style={styles.webCardTitle}>Completed ({completedChores})</Text>
              <View style={styles.webTxHeader}>
                <Text style={styles.webTxHeadCell}>Chore</Text>
                <Text style={styles.webTxHeadCell}>Reward</Text>
                <Text style={styles.webTxHeadCell}>Completed On</Text>
                <Text style={styles.webTxHeadCell}>Status</Text>
              </View>
              {chores.filter((c) => c.status === "completed").slice(0, 5).map((chore) => (
                <View key={chore.id} style={styles.webTxRow}>
                  <Text style={styles.webTxCell}>{chore.title}</Text>
                  <Text style={styles.webTxCell}>{formatMoney(chore.rewardAmount)}</Text>
                  <Text style={styles.webTxCell}>{chore.completedAt ? new Date(chore.completedAt).toLocaleDateString() : "-"}</Text>
                  <Text style={styles.tableCellSuccess}>Approved</Text>
                </View>
              ))}
              {chores.filter((c) => c.status === "completed").length === 0 ? <Text style={styles.infoText}>No completed chores yet.</Text> : null}
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "allowances" ? (
          <View style={styles.softCard}>
            <Text style={styles.cardTitle}>Allowance Schedule</Text>
            {allowances.map((allowance) => (
              <View key={allowance.id} style={styles.rowItemColumn}>
                <Text style={styles.rowMain}>{allowance.title} - {formatMoney(allowance.amount)}</Text>
                <Text style={styles.rowMeta}>{new Date(allowance.availableOn).toLocaleDateString()}</Text>
                <Text style={styles.rowMeta}>{allowance.notes ?? "No note"}</Text>
              </View>
            ))}
            {allowances.length === 0 ? <Text style={styles.infoText}>No allowances right now.</Text> : null}
          </View>
        ) : null}

        {!isLoading && tab === "actions" ? (
          <View style={styles.sectionWrap}>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Add Transaction</Text>
              <View style={styles.choiceRow}>
                <Pressable
                  style={[styles.choicePill, txType === "earn" ? styles.choicePillActive : null]}
                  onPress={() => setTxType("earn")}
                >
                  <Text style={[styles.choiceText, txType === "earn" ? styles.choiceTextActive : null]}>Earn</Text>
                </Pressable>
                <Pressable
                  style={[styles.choicePill, txType === "spend" ? styles.choicePillActive : null]}
                  onPress={() => setTxType("spend")}
                >
                  <Text style={[styles.choiceText, txType === "spend" ? styles.choiceTextActive : null]}>Spend</Text>
                </Pressable>
              </View>
              <AppInput
                label="Amount (UGX)"
                value={txAmount}
                onChangeText={setTxAmount}
                keyboardType="numeric"
                placeholder="1000"
              />
              <AppInput
                label="Description"
                value={txDescription}
                onChangeText={setTxDescription}
                placeholder="Optional"
                multiline
                numberOfLines={3}
              />
              <AppButton title="Submit Transaction" loading={isSubmitting} onPress={handleCreateTransaction} />
            </View>

            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Create Savings Goal</Text>
              <AppInput
                label="Goal Title"
                value={goalTitle}
                onChangeText={setGoalTitle}
                placeholder="Bicycle"
              />
              <AppInput
                label="Target Amount (UGX)"
                value={goalAmount}
                onChangeText={setGoalAmount}
                keyboardType="numeric"
                placeholder="250000"
              />
              <AppButton title="Create Goal" loading={isSubmitting} onPress={handleCreateSavingsGoal} />
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "settings" && isMobile ? (
          <View style={styles.mobileProfileScreen}>
            <View style={styles.mobileProfileHeader}>
              <View style={styles.mobileProfileAvatar}>
                <Text style={styles.mobileProfileAvatarText}>{username[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={styles.mobileProfileMeta}>
                <Text style={styles.mobileProfileName}>{username}</Text>
                <Text style={styles.mobileProfileLevel}>Level 4 Explorer</Text>
                <Text style={styles.mobileProfileXp}>320 / 500 XP</Text>
                <View style={styles.mobileProfileXpTrack}>
                  <View style={[styles.mobileProfileXpFill, { width: "64%" }]} />
                </View>
              </View>
            </View>

            <View style={styles.mobileProfileMenu}>
              {profileMenuItems.map((item, index) => (
                <Pressable
                  key={item}
                  onPress={() => handleProfileMenuPress(item)}
                  style={[styles.mobileProfileMenuRow, index === profileMenuItems.length - 1 ? styles.mobileRecentRowLast : null]}
                >
                  <Text style={styles.mobileProfileMenuText}>{item}</Text>
                  <View style={styles.mobileProfileMenuRight}>
                    {item === "Notifications" ? (
                      <View style={styles.mobileProfileNotifBadge}>
                        <Text style={styles.mobileProfileNotifBadgeText}>3</Text>
                      </View>
                    ) : null}
                    <Text style={styles.mobileProfileMenuArrow}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.mobileProfileInviteCard}>
              <Text style={styles.mobileProfileInviteTitle}>Invite a Friend</Text>
              <Text style={styles.mobileProfileInviteText}>Earn rewards when your friends join!</Text>
            </View>

            <Pressable style={styles.mobileProfileLogoutBtn} onPress={onLogout}>
              <Text style={styles.mobileProfileLogoutText}>Log Out</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && tab === "settings" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>My Profile</Text>
                <Text style={styles.webHelloSub}>Manage your profile and see your achievements!</Text>
              </View>
              <View style={styles.webTopActions}>
                <View style={styles.webSearch}><Text style={styles.webSearchText}>Search anything...</Text></View>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webMainCol}>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <View>
                      <Text style={styles.webHello}>{username}</Text>
                      <Text style={styles.webHelloSub}>Level 4 Explorer</Text>
                      <Text style={styles.webHelloSub}>320 / 500 XP</Text>
                    </View>
                    <Text style={styles.mobileSectionLink}>Edit</Text>
                  </View>
                  <View style={styles.webGoalsKpiRow}>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Age</Text><Text style={styles.webKpiValue}>9</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Member Since</Text><Text style={styles.webKpiValue}>Jan 15, 2025</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Favorite Color</Text><Text style={styles.webKpiValue}>Purple</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Account Type</Text><Text style={styles.webKpiValue}>Kids Account</Text></View>
                  </View>
                </View>

                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Account & Settings</Text>
                  {["App Lock (PIN)", "Change PIN", "Notification Preferences", "Privacy", "Payment & Security"].map((item) => (
                    <View key={item} style={styles.webProfileRow}>
                      <View>
                        <Text style={styles.rowMain}>{item}</Text>
                        <Text style={styles.rowMeta}>Manage this setting</Text>
                      </View>
                      <Text style={styles.webProfileArrow}>›</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.webMidCol}>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>My Badges</Text>
                    <Text style={styles.mobileSectionLink}>View All</Text>
                  </View>
                  <Text style={styles.rowMeta}>Saver | Learner | Explorer | Goal Getter | Money Master</Text>
                </View>

                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>My Stats</Text>
                    <Text style={styles.rowMeta}>This Month</Text>
                  </View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{formatMoney(walletEarned)}</Text><Text style={styles.rowMeta}>Total Earned</Text></View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{formatMoney(totalSavings)}</Text><Text style={styles.rowMeta}>Total Saved</Text></View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{completedLearningCount}</Text><Text style={styles.rowMeta}>Lessons Completed</Text></View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{completedGoalsCount}</Text><Text style={styles.rowMeta}>Goals Completed</Text></View>
                </View>
              </View>

              <View style={styles.webRightCol}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>About Me</Text>
                  <Text style={styles.rowMeta}>I love reading books</Text>
                  <Text style={styles.rowMeta}>I want to be a doctor one day</Text>
                  <Text style={styles.rowMeta}>I enjoy saving money and learning new things</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Parents & Help</Text>
                  <Text style={styles.rowMeta}>Help Center</Text>
                  <Text style={styles.rowMeta}>How KidsBank Works</Text>
                  <Text style={styles.rowMeta}>Contact Support</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Keep up the great work, {username}!</Text>
                  <Text style={styles.rowMeta}>You're learning, earning, and growing every day.</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {isMobile ? (
        <View style={styles.mobileBottomNav}>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "home" ? styles.mobileBottomNavItemActive : null,
              tab === "home" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => setTab("home")}
          >
            <Text style={[styles.mobileBottomNavIcon, tab === "home" ? styles.mobileBottomNavTextActive : null]}>⌂</Text>
            <Text style={[styles.mobileBottomNavText, tab === "home" ? styles.mobileBottomNavTextActive : null]}>Home</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "learn" ? styles.mobileBottomNavItemActive : null,
              tab === "learn" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => setTab("learn")}
          >
            <Text style={[styles.mobileBottomNavIcon, tab === "learn" ? styles.mobileBottomNavTextActive : null]}>◍</Text>
            <Text style={[styles.mobileBottomNavText, tab === "learn" ? styles.mobileBottomNavTextActive : null]}>Learn</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "savings" ? styles.mobileBottomNavItemActive : null,
              tab === "savings" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => setTab("savings")}
          >
            <Text style={[styles.mobileBottomNavIcon, tab === "savings" ? styles.mobileBottomNavTextActive : null]}>◎</Text>
            <Text style={[styles.mobileBottomNavText, tab === "savings" ? styles.mobileBottomNavTextActive : null]}>Goals</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "chores" ? styles.mobileBottomNavItemActive : null,
              tab === "chores" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => setTab("chores")}
          >
            <Text style={[styles.mobileBottomNavIcon, tab === "chores" ? styles.mobileBottomNavTextActive : null]}>✓</Text>
            <Text style={[styles.mobileBottomNavText, tab === "chores" ? styles.mobileBottomNavTextActive : null]}>Chores</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "settings" ? styles.mobileBottomNavItemActive : null,
              tab === "settings" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => setTab("settings")}
          >
            <Text style={[styles.mobileBottomNavIcon, tab === "settings" ? styles.mobileBottomNavTextActive : null]}>⚙</Text>
            <Text style={[styles.mobileBottomNavText, tab === "settings" ? styles.mobileBottomNavTextActive : null]}>Profile</Text>
          </AnimatedTileButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
    flexDirection: "row",
    gap: 12,
    position: "relative",
  },
  wrapMobile: {
    maxWidth: "100%",
    flexDirection: "column",
  },
  sidebarCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8,
  },
  sidebarCardMobile: {
    borderRadius: 14,
    padding: 12,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subBrand: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
  userText: {
    color: theme.colors.muted,
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  tabTextActive: {
    color: "#fff",
  },
  contentCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: "#f7f9ff",
  },
  contentCardInner: {
    padding: 14,
    gap: 12,
    overflow: "hidden",
  },
  contentCardMobile: {
    borderRadius: 14,
  },
  contentCardInnerMobile: {
    padding: 12,
    paddingBottom: 104,
  },
  mobileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mobileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ecebff",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileAvatarText: {
    color: theme.colors.primary,
    fontWeight: "800",
  },
  mobileHello: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  mobileUsername: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 30,
  },
  mobileBellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  mobileBellIcon: {
    color: theme.colors.text,
    fontSize: 20,
  },
  mobileBellBadge: {
    position: "absolute",
    right: 0,
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileBellBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  topRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  titleMobile: {
    fontSize: 24,
  },
  subtitle: {
    color: theme.colors.muted,
    maxWidth: 580,
  },
  subtitleMobile: {
    maxWidth: "100%",
    fontSize: 13,
    lineHeight: 18,
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
  rewardBanner: {
    borderRadius: 12,
    backgroundColor: "#ecfdf3",
    borderWidth: 1,
    borderColor: "#abefc6",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rewardText: {
    color: "#027a48",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionWrap: {
    gap: 10,
  },
  mobileBalanceCard: {
    borderRadius: 16,
    padding: 20,
    gap: 5,
    backgroundColor: "#5f35e6",
  },
  mobileBalanceLabel: {
    color: "#ddd0ff",
    fontSize: 14,
    fontWeight: "600",
  },
  mobileBalanceAmount: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "800",
  },
  mobileBalanceMeta: {
    color: "#ddd0ff",
    fontSize: 15,
  },
  mobileSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileSectionTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  mobileSectionLink: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  mobileServicesGrid: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e8f2",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  mobileServiceItem: {
    flex: 1,
    borderRadius: 0,
    borderRightWidth: 1,
    borderRightColor: "#eceef7",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 6,
  },
  mobileServiceIcon: {
    fontSize: 20,
  },
  mobileServiceLabel: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  mobileRecentCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mobileRecentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f5",
  },
  mobileRecentRowLast: {
    borderBottomWidth: 0,
  },
  mobileRecentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecebff",
  },
  mobileRecentIcon: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  mobileRecentAmount: {
    fontWeight: "800",
    fontSize: 20,
  },
  mobileAmountPositive: {
    color: theme.colors.success,
  },
  mobileAmountNegative: {
    color: theme.colors.danger,
  },
  mobileGoalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e8f2",
    backgroundColor: "#f4f3ff",
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  mobileGoalProgress: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 5,
    borderColor: "#6b42ef",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  mobileGoalProgressText: {
    color: "#1e2340",
    fontWeight: "800",
    fontSize: 13,
  },
  mobileGoalMain: {
    flex: 1,
    gap: 4,
  },
  mobileGoalTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  mobileGoalMeta: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "500",
  },
  mobileGoalTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#dfdcff",
    overflow: "hidden",
  },
  mobileGoalTrackFill: {
    height: "100%",
    backgroundColor: "#6a42ef",
    borderRadius: 999,
  },
  mobileGoalHint: {
    color: "#6a42ef",
    fontSize: 11,
    fontWeight: "700",
  },
  webFundRow: {
    marginTop: 8,
    gap: 8,
  },
  mobileGoalEmptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e8f4",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8,
  },
  mobileGoalEmptyTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  mobileGoalEmptyText: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  mobileTipCard: {
    borderRadius: 14,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#f0e6d2",
    padding: 12,
    gap: 4,
  },
  mobileTipTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  mobileTipText: {
    color: "#5a5f74",
    fontSize: 13,
    lineHeight: 18,
  },
  mobileLearnHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  mobileLearnTitle: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: "800",
  },
  mobileLearnSubtitle: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  mobileCoinsPill: {
    borderRadius: 12,
    backgroundColor: "#fff8e6",
    borderWidth: 1,
    borderColor: "#f5dfb1",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 92,
  },
  mobileCoinsValue: {
    color: "#1d2538",
    fontWeight: "800",
    fontSize: 20,
  },
  mobileCoinsLabel: {
    color: "#6c738d",
    fontSize: 10,
    fontWeight: "700",
  },
  mobileLearnHero: {
    borderRadius: 14,
    backgroundColor: "#f3f2ff",
    borderWidth: 1,
    borderColor: "#e6e8f4",
    padding: 14,
  },
  mobileLearnHeroTitle: {
    color: "#1e2340",
    fontWeight: "800",
    fontSize: 22,
    lineHeight: 27,
  },
  mobileLearnHeroLabel: {
    marginTop: 10,
    color: "#6a7088",
    fontSize: 12,
    fontWeight: "700",
  },
  mobileLearnHeroPercent: {
    marginTop: 6,
    color: "#6a42ef",
    fontSize: 12,
    fontWeight: "800",
    alignSelf: "flex-end",
  },
  mobileLearnTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eceef5",
  },
  mobileLearnTab: {
    color: "#6e7693",
    fontSize: 12,
    fontWeight: "600",
  },
  mobileLearnTabActive: {
    color: "#6a42ef",
    fontSize: 12,
    fontWeight: "800",
  },
  mobileContinueCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eceef7",
    padding: 10,
  },
  mobileContinueIcon: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#eeebff",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileContinueIconText: {
    fontSize: 30,
  },
  mobileContinueMain: {
    flex: 1,
    gap: 2,
  },
  mobileContinueFooter: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileContinueTrack: {
    flex: 1,
  },
  mobileLessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f8",
  },
  mobileLessonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f7f5ff",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileLessonIcon: {
    fontSize: 20,
  },
  mobileChoreTabs: {
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: "#ececf6",
    padding: 4,
    gap: 4,
  },
  mobileChoreTab: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  mobileChoreTabActive: {
    backgroundColor: "#5f35e6",
  },
  mobileChoreTabText: {
    color: "#495168",
    fontSize: 12,
    fontWeight: "700",
  },
  mobileChoreTabTextActive: {
    color: "#fff",
  },
  mobileChoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f8",
    paddingBottom: 10,
    marginBottom: 10,
  },
  mobileChoreActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  mobileDueTag: {
    color: "#8f6a00",
    backgroundColor: "#fff8e7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
  },
  mobileMarkDoneBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6a42ef",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mobileMarkDoneText: {
    color: "#5f35e6",
    fontWeight: "700",
    fontSize: 12,
  },
  mobileProfileScreen: {
    borderRadius: 16,
    backgroundColor: "#080b2b",
    borderWidth: 1,
    borderColor: "#1d2255",
    padding: 12,
    gap: 12,
  },
  mobileProfileHeader: {
    flexDirection: "row",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1f4d",
    paddingBottom: 12,
  },
  mobileProfileAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#2c3173",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileProfileAvatarText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },
  mobileProfileMeta: {
    flex: 1,
    gap: 4,
  },
  mobileProfileName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  mobileProfileLevel: {
    color: "#9ea9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  mobileProfileXp: {
    color: "#cfd5ff",
    fontSize: 12,
    fontWeight: "600",
  },
  mobileProfileXpTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1e245f",
    overflow: "hidden",
    marginTop: 2,
  },
  mobileProfileXpFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#7048ff",
  },
  mobileProfileMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1d2255",
    backgroundColor: "#0a0e34",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mobileProfileMenuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#161b49",
  },
  mobileProfileMenuText: {
    color: "#f3f4ff",
    fontSize: 14,
    fontWeight: "600",
  },
  mobileProfileMenuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileProfileMenuArrow: {
    color: "#97a2ff",
    fontSize: 20,
    fontWeight: "600",
  },
  mobileProfileNotifBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#6d4bff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  mobileProfileNotifBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  mobileProfileInviteCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2f66",
    backgroundColor: "#1a1f52",
    padding: 14,
    gap: 6,
  },
  mobileProfileInviteTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  mobileProfileInviteText: {
    color: "#d4d9ff",
    fontSize: 13,
    lineHeight: 18,
  },
  mobileProfileLogoutBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2e3475",
    backgroundColor: "#151a49",
    alignItems: "center",
    paddingVertical: 11,
  },
  mobileProfileLogoutText: {
    color: "#a9b2ff",
    fontSize: 16,
    fontWeight: "700",
  },
  tableCellSuccess: {
    color: "#2ca05e",
    fontSize: 11,
    fontWeight: "700",
  },
  tableCellPending: {
    color: "#d5a217",
    fontSize: 11,
    fontWeight: "700",
  },
  webSidebar: {
    width: 220,
    borderRadius: 14,
    backgroundColor: "#10174f",
    padding: 12,
    gap: 12,
  },
  webBrandWrap: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3276",
  },
  webBrand: {
    color: "#eaf0ff",
    fontWeight: "800",
    fontSize: 32,
  },
  webNavList: {
    gap: 6,
    flex: 1,
  },
  webNavItem: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  webNavItemActive: {
    backgroundColor: "#5f46f1",
  },
  webNavIconPill: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#202b75",
  },
  webNavIconPillActive: {
    backgroundColor: "#ffffff",
  },
  webNavIcon: {
    color: "#b8c3ff",
    fontSize: 13,
    fontWeight: "900",
  },
  webNavIconActive: {
    color: "#5f46f1",
  },
  webNavText: {
    flex: 1,
    color: "#d7deff",
    fontWeight: "700",
    fontSize: 16,
  },
  webNavTextActive: {
    color: "#fff",
  },
  webSidebarFooter: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b357b",
    backgroundColor: "#18246f",
    padding: 10,
    gap: 3,
  },
  webFooterTitle: {
    color: "#f3f6ff",
    fontWeight: "700",
    fontSize: 13,
  },
  webFooterSub: {
    color: "#c8d0fb",
    fontSize: 12,
  },
  webLogoutBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3b468f",
    backgroundColor: "#171f62",
    paddingVertical: 10,
    alignItems: "center",
  },
  webLogoutBtnText: {
    color: "#d7deff",
    fontWeight: "800",
    fontSize: 13,
  },
  webTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    zIndex: 2,
  },
  webHello: {
    color: "#1f2750",
    fontSize: 18,
    fontWeight: "800",
  },
  webHelloSub: {
    color: "#636c8a",
    fontSize: 13,
  },
  webTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  webSearch: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e7f3",
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 210,
  },
  webSearchText: {
    color: "#97a1bf",
    fontSize: 12,
  },
  webProfilePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e7f3",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  webProfileName: {
    color: "#2d3557",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  webGridWrap: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
    zIndex: 2,
  },
  webMainCol: {
    flex: 1.6,
    gap: 12,
  },
  webMidCol: {
    flex: 1.25,
    gap: 12,
  },
  webRightCol: {
    flex: 0.75,
    gap: 12,
  },
  webWalletHero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#5e46f1",
    backgroundColor: "#6a43f4",
    padding: 14,
    gap: 7,
  },
  webHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  webHeroMain: {
    flex: 1,
  },
  webHeroImage: {
    width: 88,
    height: 88,
    opacity: 0.95,
  },
  webWalletTitle: {
    color: "#f0eaff",
    fontSize: 16,
    fontWeight: "800",
  },
  webWalletLabel: {
    color: "#ddd2ff",
    fontSize: 13,
  },
  webWalletValue: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "800",
  },
  webWalletStats: {
    marginTop: 4,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  webWalletStat: {
    color: "#f4ecff",
    fontSize: 11,
    fontWeight: "700",
  },
  webCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    backgroundColor: "#fff",
    padding: 14,
    gap: 10,
    zIndex: 2,
  },
  webBgLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  webBgArtMain: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    opacity: 0.34,
  },
  webSideImage: {
    width: 68,
    height: 68,
    alignSelf: "flex-end",
    marginTop: -2,
  },
  webSideImageSmall: {
    width: 52,
    height: 52,
    alignSelf: "flex-end",
    marginTop: -2,
  },
  webCardTitle: {
    color: "#363f69",
    fontSize: 14,
    fontWeight: "800",
  },
  webRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  webGoalPct: {
    color: "#4caf67",
    fontWeight: "800",
    fontSize: 28,
  },
  webMiniBtn: {
    borderRadius: 10,
    backgroundColor: "#5f46f1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webMiniBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  webQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  webQuickItem: {
    minWidth: 78,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eceef7",
    backgroundColor: "#fbfcff",
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  webQuickText: {
    color: "#394263",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  webAllowanceValue: {
    color: "#283150",
    fontSize: 32,
    fontWeight: "800",
  },
  webWalletTopGrid: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  webTrendChart: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#edf0f8",
    backgroundColor: "#f9fbff",
    position: "relative",
  },
  webTrendPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4cb564",
    position: "absolute",
  },
  webWalletBottomGrid: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  webWalletRightCol: {
    width: 280,
    gap: 10,
  },
  webTxHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingBottom: 6,
  },
  webTxHeadCell: {
    flex: 1,
    color: "#67708f",
    fontSize: 11,
    fontWeight: "700",
  },
  webTxRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4fb",
    paddingVertical: 8,
  },
  webTxCell: {
    flex: 1,
    color: "#344055",
    fontSize: 11,
    fontWeight: "600",
  },
  webDoneBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4bb861",
    backgroundColor: "#eaf9ef",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  webDoneBtnText: {
    color: "#259947",
    fontSize: 11,
    fontWeight: "800",
  },
  webGoalsTopGrid: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  webGoalsBanner: {
    flex: 1.2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    backgroundColor: "#f4f2ff",
    padding: 14,
    justifyContent: "center",
  },
  webGoalsBannerText: {
    color: "#363f69",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
    maxWidth: 360,
  },
  webGoalsKpiRow: {
    flex: 1.8,
    flexDirection: "row",
    gap: 8,
  },
  webGoalsKpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    backgroundColor: "#fff",
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  webKpiLabel: {
    color: "#687191",
    fontSize: 11,
    fontWeight: "700",
  },
  webKpiValue: {
    color: "#2b3557",
    fontSize: 24,
    fontWeight: "800",
  },
  webGoalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  activeGoalsCard: {
    flex: 1,
    minWidth: 360,
  },
  savingsArchiveArea: {
    width: 560,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  savingsInfoStack: {
    width: 210,
    gap: 10,
  },
  completedGoalsArchiveCard: {
    flex: 1,
  },
  completedGoalsArchiveGrid: {
    gap: 8,
  },
  webGoalTile: {
    width: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eaedf7",
    backgroundColor: "#fff",
    padding: 10,
    gap: 6,
  },
  webGoalTileCta: {
    flex: 1,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d7dcf2",
    backgroundColor: "#fbfcff",
    padding: 12,
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  achievementCard: {
    borderColor: "#f2ce6b",
    backgroundColor: "#fff8df",
  },
  achievementIcon: {
    color: "#d79a00",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
  },
  completedGoalMiniCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#edf0f8",
    backgroundColor: "#ffffff",
    padding: 9,
    gap: 2,
  },
  webProfileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f8",
    paddingVertical: 10,
    gap: 8,
  },
  webProfileArrow: {
    color: "#7b84a4",
    fontSize: 20,
    fontWeight: "700",
  },
  webProfileStatCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#edf0f8",
    backgroundColor: "#fbfcff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  kpiGrid: {
    gap: 10,
  },
  kpiGridMobile: {
    gap: 8,
  },
  kpiCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiYellow: {
    backgroundColor: "#f6dc84",
    borderColor: "#f0cf5d",
  },
  kpiBlue: {
    backgroundColor: "#d5dfef",
    borderColor: "#c5d2e7",
  },
  kpiPurple: {
    backgroundColor: "#ddd3eb",
    borderColor: "#d3c4e6",
  },
  kpiLabel: {
    color: "#323658",
    fontWeight: "700",
    fontSize: 12,
  },
  kpiValue: {
    marginTop: 6,
    color: "#1f2434",
    fontWeight: "800",
    fontSize: 24,
  },
  kpiValueMobile: {
    fontSize: 20,
  },
  cardList: {
    gap: 10,
  },
  softCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#f8f9ff",
    padding: 12,
    gap: 10,
  },
  softCardMobile: {
    padding: 10,
    gap: 8,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18,
  },
  rowItem: {
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowItemMobile: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  rowContent: {
    flex: 1,
    width: "100%",
    gap: 2,
  },
  rowItemColumn: {
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  rowMain: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  rowMeta: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  rowMetaRightMobile: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  mobileBottomNav: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  mobileBottomNavItem: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 56,
  },
  mobileBottomNavItemActive: {
    backgroundColor: "#ecebff",
  },
  mobileBottomNavIcon: {
    fontSize: 15,
    color: theme.colors.muted,
  },
  mobileBottomNavText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  mobileBottomNavTextActive: {
    color: theme.colors.primary,
  },
  rowButtonWrap: {
    marginTop: 6,
  },
  withdrawForm: {
    gap: 10,
  },
  withdrawGoalList: {
    gap: 8,
  },
  withdrawGoalOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 2,
  },
  withdrawGoalOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "#ecebff",
  },
  learningActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
  },
  learningSecondaryActionStack: {
    gap: 6,
  },
  learningActionBtnPrimary: {
    borderRadius: 999,
    backgroundColor: "#5f46f1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  learningActionBtnPrimaryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  learningActionBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9def2",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  learningActionBtnText: {
    color: "#4f5a7e",
    fontSize: 11,
    fontWeight: "800",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  choicePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  choicePillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "#ecebff",
  },
  choiceText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: theme.colors.primary,
  },
});
