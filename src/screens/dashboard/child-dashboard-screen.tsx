import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  AllowanceSummary,
  apiChangePassword,
  apiClearChildBudget,
  apiChildAllowances,
  apiChildChores,
  apiChildLearningLessons,
  apiChildSavingsGoals,
  apiChildTransactions,
  apiChildWallet,
  apiSaveChildBudget,
  apiCompleteChildChore,
  apiCreateChildWithdrawal,
  apiCreateChildSavingsGoal,
  apiCreateChildTransaction,
  apiFundChildGoal,
  apiLogDashboardAction,
  apiMe,
  apiUpdateChildLearningProgress,
  apiUpdateChildProfile,
  API_BASE_URL,
  ChildAchievementSummary,
  ChildBudgetSummary,
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
  { label: "Home", key: "home", icon: "\u{1F3E0}" },
  { label: "Wallet", key: "wallet", icon: "\u{1F45B}" },
  { label: "Goals", key: "savings", icon: "\u{1F3AF}" },
  { label: "Chores", key: "chores", icon: "\u2705" },
  { label: "Learn & Earn", key: "learn", icon: "\u{1F4DA}" },
  { label: "Transactions", key: "transactions", icon: "\u{1F4CB}" },
  { label: "Notifications", key: "notifications", icon: "\u{1F514}" },
  { label: "Profile", key: "settings", icon: "\u2699\uFE0F" },
];

function resolveChildProfileImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

const formatMoney = (value: number) => `UGX ${value.toLocaleString()}`;
function addImageCacheBuster(uri: string | null, version: number): string | null {
  if (!uri || version === 0 || uri.startsWith("data:") || uri.startsWith("file:") || uri.startsWith("blob:")) return uri;
  return `${uri}${uri.includes("?") ? "&" : "?"}v=${version}`;
}
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
const learnIllustration1 = require("../../../assets/Learn/Learn1.jpg");
const learnIllustration2 = require("../../../assets/Learn/Learn2.jpg");
const learnIllustration3 = require("../../../assets/Learn/Learn3.jpg");
const goalIllustration1 = require("../../../assets/Goal/Goal1.jpg");
const choreIllustration1 = require("../../../assets/Chore/Chore1.jpg");
const moneyIllustration1 = require("../../../assets/money/money1.jpg");
const dailyMoneyTips = [
  "Save a little first, then decide what to spend. Future you will smile.",
  "Before buying something, ask: do I need it, or do I just want it today?",
  "Big goals become easier when you break them into tiny saving steps.",
  "Earning money feels great, but planning it makes it last longer.",
  "Keep some money for saving, some for spending, and some for sharing.",
  "A good budget is like a map: it shows your money where to go.",
  "If you wait one day before buying, you may discover you do not need it.",
  "Every coin you save is a small teammate helping your goal get closer.",
  "Track your money after you spend it so you can make smarter choices next time.",
  "When you finish a chore, think about saving part of your reward before spending.",
  "Choose one goal at a time and give it a little money whenever you can.",
  "Smart money habits are built by small choices repeated often.",
];

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

function getTabHeroImage(tab: TabKey) {
  if (tab === "wallet") return walletIllustration4;
  if (tab === "savings") return goalIllustration1;
  if (tab === "chores") return choreIllustration1;
  if (tab === "learn") return learnIllustration2;
  if (tab === "transactions") return moneyIllustration1;
  if (tab === "notifications") return bgIllustration2;
  if (tab === "settings") return learnIllustration3;
  if (tab === "actions") return walletIllustration5;
  return moneyIllustration1;
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
  const mobileTopInset = isMobile && Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 0;
  const mobileBottomInset = isMobile ? (Platform.OS === "android" ? 44 : 28) : 0;
  const username = email.split("@")[0];
  const dailyTip = useMemo(() => {
    const today = new Date();
    const daySeed = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    return dailyMoneyTips[daySeed % dailyMoneyTips.length];
  }, []);

  const [tab, setTab] = useState<TabKey>("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [chores, setChores] = useState<ChoreSummary[]>([]);
  const [allowances, setAllowances] = useState<AllowanceSummary[]>([]);
  const [assignedLessons, setAssignedLessons] = useState<ChildLearningLesson[]>([]);
  const [achievements, setAchievements] = useState<ChildAchievementSummary[]>([]);
  const [budget, setBudget] = useState<ChildBudgetSummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

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
  const [childNickname, setChildNickname] = useState<string | null>(null);
  const [childFullName, setChildFullName] = useState<string | null>(null);
  const [childProfileImageUrl, setChildProfileImageUrl] = useState<string | null>(null);
  const [profileImageRefreshKey, setProfileImageRefreshKey] = useState(0);
  const [childAge, setChildAge] = useState<number | null>(null);
  const [childAboutMe, setChildAboutMe] = useState<string | null>(null);
  const [aboutMeDraft, setAboutMeDraft] = useState("");

  const childDisplayName = useMemo(
    () => (childNickname?.trim() || childFullName?.trim() || username).trim(),
    [childNickname, childFullName, username]
  );
  const resolvedSidebarAvatarUri = useMemo(
    () => addImageCacheBuster(resolveChildProfileImageUrl(childProfileImageUrl), profileImageRefreshKey),
    [childProfileImageUrl, profileImageRefreshKey]
  );

  const balanceAnim = useRef(new Animated.Value(0)).current;
  const homeEnterAnim = useRef(new Animated.Value(0)).current;
  const activeTabAnim = useRef(new Animated.Value(1)).current;
  const rewardAnim = useRef(new Animated.Value(0)).current;
  const sidebarTranslateX = useRef(new Animated.Value(-286)).current;
  const sidebarBackdropOpacity = useRef(new Animated.Value(0)).current;

  const completedChores = useMemo(
    () => chores.filter((chore) => chore.status === "completed").length,
    [chores]
  );
  const pendingChores = useMemo(() => chores.filter((chore) => chore.status === "assigned").length, [chores]);
  const totalChoreRewards = useMemo(
    () => chores.filter((chore) => chore.status === "completed").reduce((sum, chore) => sum + chore.rewardAmount, 0),
    [chores]
  );
  const featuredGoal = savingsGoals.find((goal) => goal.status !== "completed" && !goal.completedAt);
  const latestAllowance = allowances[0];
  const pendingTransactions = useMemo(() => transactions.filter((tx) => tx.status === "pending").length, [transactions]);
  const totalSavings = useMemo(() => savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0), [savingsGoals]);
  const activeGoalProgress = featuredGoal
    ? Math.min(100, Math.round((featuredGoal.currentAmount / featuredGoal.targetAmount) * 100))
    : 0;
  const walletBalance = wallet?.balance ?? 0;
  const walletEarned = wallet?.totalEarned ?? 0;
  const walletSpent = wallet?.totalSpent ?? 0;
  const suggestedBudget = useMemo(
    () => ({
      saveAmount: Math.round(walletBalance * 0.5),
      spendAmount: Math.round(walletBalance * 0.3),
      shareAmount: Math.max(0, walletBalance - Math.round(walletBalance * 0.5) - Math.round(walletBalance * 0.3)),
    }),
    [walletBalance]
  );
  const displayedBudget = budget ?? suggestedBudget;
  const hasSavedBudget = Boolean(budget);
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
  const badgeCatalog = useMemo(() => {
    const hasBadge = (pattern: RegExp) =>
      achievements.some((achievement) => pattern.test(`${achievement.title} ${achievement.description ?? ""}`));

    return [
      {
        key: "budget",
        title: "Budget Builder",
        description: "Save a budget plan",
        icon: "\u{1F4B0}",
        unlocked: hasBadge(/budget builder|budget/i),
      },
      {
        key: "goal",
        title: "Golden Goal",
        description: "Hit a savings goal",
        icon: "\u2B50",
        unlocked: hasBadge(/golden star|completed savings goal/i),
      },
      {
        key: "learning",
        title: "Learning Star",
        description: "Complete a lesson",
        icon: "\u{1F393}",
        unlocked: hasBadge(/learning star|completed lesson/i),
      },
    ];
  }, [achievements]);
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
  const notificationItems = useMemo(
    () =>
      transactions.slice(0, 8).map((tx) => ({
        id: tx.id,
        title: tx.type === "spend" ? "Withdrawal update" : "Money received",
        message: tx.type === "spend" ? "Your withdrawal request was processed." : "You received a wallet credit.",
        createdAt: tx.createdAt,
        isRead: readNotificationIds.includes(tx.id),
      })),
    [readNotificationIds, transactions]
  );
  const unreadNotificationCount = notificationItems.filter((item) => !item.isRead).length;
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
          subtitle: `${lesson.resourceType.toUpperCase()}${lesson.fileName ? ` - ${lesson.fileName}` : ""}`,
          statusLabel: completed ? "Completed" : progress > 0 ? "In Progress" : "Ready",
          progress,
          resourceLabel: lesson.resourceType === "video" ? "Watch" : lesson.resourceType === "pdf" ? "Open PDF" : "Read",
        };
      }),
    [assignedLessons]
  );
  const completedLearningCount = learningLessons.filter((lesson) => lesson.progress >= 100).length;
  const learningStarsEarned = Math.max(
    completedLearningCount,
    achievements.filter((achievement) => /learning star/i.test(`${achievement.title} ${achievement.description ?? ""}`)).length
  );
  const totalStarsEarned = achievements.reduce((sum, achievement) => sum + Math.max(0, achievement.points), 0);
  const quizzesPassed = achievements.filter((achievement) => /quiz/i.test(`${achievement.title} ${achievement.description ?? ""}`)).length;
  const rewardsGotten = achievements.length + completedChores;
  const learningProgressPercent = learningLessons.length
    ? Math.round(learningLessons.reduce((total, lesson) => total + lesson.progress, 0) / learningLessons.length)
    : 0;
  const nextLearningLesson = learningLessons.find((lesson) => lesson.progress < 100) ?? learningLessons[0];

  async function loadDashboardData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [meData, walletData, txData, savingsData, choresData, allowancesData, lessonsData] = await Promise.all([
        apiMe(),
        apiChildWallet(),
        apiChildTransactions(),
        apiChildSavingsGoals(),
        apiChildChores(),
        apiChildAllowances(),
        apiChildLearningLessons().catch(() => ({ lessons: [] as ChildLearningLesson[] })),
      ]);

      setChildNickname(meData.user.nickname ?? null);
      setChildFullName(meData.user.fullName ?? null);
      setChildProfileImageUrl(meData.user.profileImageUrl ?? null);
      setChildAge(meData.user.childAge ?? null);
      setChildAboutMe(meData.user.aboutMe ?? null);
      setAboutMeDraft(meData.user.aboutMe ?? "");

      setWallet(walletData.wallet);
      setSavingsGoals(walletData.savingsGoals.length > 0 ? walletData.savingsGoals : savingsData.savingsGoals);
      setAchievements(walletData.achievements ?? []);
      setBudget(walletData.budget ?? null);
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
    if (!isMobile) {
      sidebarTranslateX.setValue(0);
      sidebarBackdropOpacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(sidebarTranslateX, {
        toValue: isSidebarOpen ? 0 : -286,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sidebarBackdropOpacity, {
        toValue: isSidebarOpen ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isMobile, isSidebarOpen, sidebarBackdropOpacity, sidebarTranslateX]);

  useEffect(() => {
    if (tab !== "notifications" || notificationItems.length === 0) return;
    const unreadIds = notificationItems.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0) return;
    setReadNotificationIds((prev) => Array.from(new Set([...prev, ...unreadIds])));
  }, [notificationItems, tab]);
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

  function renderBadgesSection() {
    if (tab !== "home" || isLoading) return null;

    const unlockedCount = badgeCatalog.filter((badge) => badge.unlocked).length;

    return (
      <View style={[styles.badgesSection, isMobile ? styles.badgesSectionMobile : null]}>
        <View style={styles.webRowBetween}>
          <View>
            <Text style={styles.badgesTitle}>Badges & Stars</Text>
            <Text style={styles.badgesSubtitle}>{unlockedCount} of {badgeCatalog.length} unlocked</Text>
          </View>
          <Text style={styles.badgesSparkle}>{"\u2728"}</Text>
        </View>
        <View style={styles.badgesRow}>
          {badgeCatalog.map((badge) => (
            <View key={badge.key} style={[styles.badgeTile, badge.unlocked ? styles.badgeTileUnlocked : styles.badgeTileLocked]}>
              <Text style={[styles.badgeIcon, badge.unlocked ? null : styles.badgeIconLocked]}>{badge.icon}</Text>
              <View style={styles.badgeTextWrap}>
                <Text style={styles.badgeTitleText}>{badge.title}</Text>
                <Text style={styles.badgeDescription}>{badge.unlocked ? "Unlocked" : badge.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
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

  async function handleSaveBudgetPreset(kind: "smart" | "saveMore") {
    if (!wallet || wallet.balance <= 0) {
      setErrorMessage("Add money to your wallet before making a budget.");
      return;
    }

    const amounts =
      kind === "saveMore"
        ? {
            saveAmount: Math.round(walletBalance * 0.6),
            spendAmount: Math.round(walletBalance * 0.25),
            shareAmount: Math.max(0, walletBalance - Math.round(walletBalance * 0.6) - Math.round(walletBalance * 0.25)),
          }
        : suggestedBudget;

    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiSaveChildBudget({
        title: kind === "saveMore" ? "Save More Budget" : "Smart Budget",
        saveAmount: amounts.saveAmount,
        spendAmount: amounts.spendAmount,
        shareAmount: amounts.shareAmount,
        periodType: "monthly",
      });
      setBudget(data.budget);
      setStatusMessage(data.message);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not save budget.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClearBudget() {
    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiClearChildBudget();
      setBudget(null);
      setStatusMessage(data.message);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not clear budget.");
    } finally {
      setIsSubmitting(false);
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

  async function handleSaveAboutMe() {
    setIsSubmitting(true);
    clearMessages();

    try {
      const data = await apiUpdateChildProfile({ aboutMe: aboutMeDraft });
      setChildAboutMe(data.profile.aboutMe);
      setAboutMeDraft(data.profile.aboutMe ?? "");
      setStatusMessage(data.message);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update About Me.");
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handlePickProfileImage() {
    setIsSubmitting(true);
    clearMessages();

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Please allow photo access so you can choose a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setChildProfileImageUrl(asset.uri);
      setProfileImageRefreshKey(Date.now());

      const profileImageUrl = asset.base64 ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : asset.uri;
      const data = await apiUpdateChildProfile({ aboutMe: aboutMeDraft, profileImageUrl });
      setChildAboutMe(data.profile.aboutMe);
      setChildProfileImageUrl(data.profile.profileImageUrl ?? asset.uri);
      setProfileImageRefreshKey(Date.now());
      setAboutMeDraft(data.profile.aboutMe ?? "");
      setStatusMessage("Profile picture updated.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update profile picture.");
    } finally {
      setIsSubmitting(false);
    }
  }
  function handleTabPress(nextTab: TabKey) {
    setTab(nextTab);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
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
    <View style={[styles.wrap, isMobile ? styles.wrapMobile : null, isMobile ? { paddingTop: mobileTopInset } : null]}>
      {isMobile ? (
        <Animated.View pointerEvents={isSidebarOpen ? "auto" : "none"} style={[styles.mobileSidebarBackdrop, { opacity: sidebarBackdropOpacity }]}>
          <Pressable style={styles.mobileSidebarBackdropTap} onPress={() => setIsSidebarOpen(false)} />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.webSidebar,
          isMobile ? styles.webSidebarMobileDrawer : null,
          isMobile ? { transform: [{ translateX: sidebarTranslateX }] } : null,
        ]}
      >
          <View style={[styles.webBrandWrap, isMobile ? styles.webBrandWrapMobile : null]}>
            <Text style={styles.webBrand}>KidsBank</Text>
            {isMobile ? (
              <Pressable style={styles.mobileSidebarCloseBtn} onPress={() => setIsSidebarOpen(false)}>
                <Text style={styles.mobileSidebarCloseText}>x</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.webSidebarProfile}>
            <View style={styles.webSidebarAvatarOuter}>
              {resolvedSidebarAvatarUri ? (
                <Image key={resolvedSidebarAvatarUri} source={{ uri: resolvedSidebarAvatarUri }} style={styles.webSidebarAvatarImage} resizeMode="cover" />
              ) : (
                <View style={styles.webSidebarAvatarPlaceholder}>
                  <Text style={styles.webSidebarAvatarInitial}>{childDisplayName[0]?.toUpperCase() ?? "?"}</Text>
                </View>
              )}
            </View>
            <Text style={styles.webSidebarChildName} numberOfLines={2}>
              {childDisplayName}
            </Text>
            <View style={styles.webAvatarTrail}>
              {[learnIllustration1, goalIllustration1, choreIllustration1].map((avatar, index) => (
                <Image key={"avatar-" + index} source={avatar} style={styles.webAvatarTrailImage} resizeMode="cover" />
              ))}
            </View>
          </View>
          <View style={styles.webNavList}>
            {webNavItems.map((item) => {
              const active = tab === item.key;
              return (
                <Pressable key={item.key} style={[styles.webNavItem, active ? styles.webNavItemActive : null]} onPress={() => handleTabPress(item.key)}>
                  <View style={[styles.webNavIconPill, active ? styles.webNavIconPillActive : null]}>
                    <Text style={styles.webNavIconEmoji}>{item.icon}</Text>
                  </View>
                  <Text style={[styles.webNavText, active ? styles.webNavTextActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.webLogoutBtn} onPress={onLogout}>
            <Text style={styles.webLogoutBtnText}>Log Out</Text>
          </Pressable>
        </Animated.View>

      <ScrollView
        style={[styles.contentCard, isMobile ? styles.contentCardMobile : null]}
        contentContainerStyle={[
          styles.contentCardInner,
          isMobile ? styles.contentCardInnerMobile : null,
          isMobile ? { paddingBottom: 124 + mobileBottomInset } : null,
        ]}
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
                {resolvedSidebarAvatarUri ? (
                  <Image key={resolvedSidebarAvatarUri} source={{ uri: resolvedSidebarAvatarUri }} style={styles.mobileAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.mobileAvatarText}>{childDisplayName[0]?.toUpperCase() ?? "?"}</Text>
                )}
              </View>
              <View>
                <Text style={styles.mobileUsername}>Hi, {childDisplayName}!</Text>
                <Text style={styles.mobileHello}>Let's learn, save and grow!</Text>
              </View>
            </View>
            <Image source={getTabHeroImage(tab)} style={styles.mobileHeaderArt} resizeMode="cover" />
            <Pressable style={styles.mobileMenuBtn} onPress={() => setIsSidebarOpen(true)}>
              <View style={styles.mobileMenuLine} />
              <View style={styles.mobileMenuLine} />
              <View style={styles.mobileMenuLine} />
            </Pressable>
            <Pressable style={styles.mobileBellBtn} onPress={() => handleTabPress("notifications")}>
              <Text style={styles.mobileBellIcon}>{"\u{1F514}"}</Text>
              {unreadNotificationCount > 0 ? (
                <View style={styles.mobileBellBadge}>
                  <Text style={styles.mobileBellBadgeText}>{Math.min(9, unreadNotificationCount)}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ) : (
          <View style={styles.webTopRow}>
            <View>
              <Text style={styles.webHello}>Hello, {childDisplayName}!</Text>
              <Text style={styles.webHelloSub}>Let's learn, save and grow together!</Text>
            </View>
          </View>
        )}

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        {safeErrorMessage ? <Text style={styles.errorText}>{safeErrorMessage}</Text> : null}
        {isLoading ? <Text style={styles.infoText}>Loading dashboard...</Text> : null}
        {renderBadgesSection()}

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
            <Text style={styles.rewardText}>Awesome work! {"\u2B50"} Chore completed</Text>
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
              <Image source={moneyIllustration1} style={styles.mobileBalanceMascot} resizeMode="contain" />
              <Text style={styles.mobileBalanceLabel}>My Wallet Balance</Text>
              <Text style={styles.mobileBalanceAmount}>{formatMoney(displayBalance)}</Text>
              <Text style={styles.mobileBalanceMeta}>Available Balance</Text>
            </View>

            <View style={styles.mobileServicesGrid}>
              <AnimatedTileButton
                style={[styles.mobileServiceItem, styles.mobileServiceItemMoney]}
                onPress={() => {
                  setTxType("earn");
                  setTab("actions");
                }}
              >
                <Text style={styles.mobileServiceIcon}>{"\u{1F4BC}"}</Text>
                <Text style={styles.mobileServiceLabel}>Add Money</Text>
              </AnimatedTileButton>
              <AnimatedTileButton
                style={[styles.mobileServiceItem, styles.mobileServiceItemRequest]}
                onPress={() => {
                  setTxType("earn");
                  setTxDescription("Money request");
                  setTab("actions");
                }}
              >
                <Text style={styles.mobileServiceIcon}>{"\u2708"}</Text>
                <Text style={styles.mobileServiceLabel}>Request Money</Text>
              </AnimatedTileButton>
              <AnimatedTileButton style={[styles.mobileServiceItem, styles.mobileServiceItemGoals]} onPress={() => setTab("savings")}>
                <Text style={styles.mobileServiceIcon}>{"\u{1F3AF}"}</Text>
                <Text style={styles.mobileServiceLabel}>My Goals</Text>
              </AnimatedTileButton>
              <AnimatedTileButton style={[styles.mobileServiceItem, styles.mobileServiceItemChores]} onPress={() => setTab("chores")}>
                <Text style={styles.mobileServiceIcon}>{"\u{1F4CB}"}</Text>
                <Text style={styles.mobileServiceLabel}>My Chores</Text>
              </AnimatedTileButton>
            </View>

            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>Today's Overview</Text>
              <Pressable onPress={() => setTab("transactions")}>
                <Text style={styles.mobileSectionLink}>View All</Text>
              </Pressable>
            </View>
            <View style={[styles.mobileRecentCard, styles.kidCardBlue]}>
              <View style={styles.mobileRecentRow}>
                <View style={styles.mobileRecentIconWrap}>
                  <Text style={styles.mobileRecentIcon}>{"\u{1F381}"}</Text>
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
                  <Text style={styles.mobileRecentIcon}>{"\u2B50"}</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>Chore Reward</Text>
                  <Text style={styles.rowMeta}>{completedChores} chores completed</Text>
                </View>
                <Text style={[styles.mobileRecentAmount, styles.mobileAmountPositive]}>+ UGX 5,000</Text>
              </View>
              <View style={[styles.mobileRecentRow, styles.mobileRecentRowLast]}>
                <View style={styles.mobileRecentIconWrap}>
                  <Text style={styles.mobileRecentIcon}>{"\u{1F552}"}</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowMain}>Pending Requests</Text>
                  <Text style={styles.rowMeta}>Needs approval</Text>
                </View>
                <Text style={styles.mobileRecentAmount}>{pendingChores}</Text>
              </View>
            </View>

            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>My Active Goal</Text>
              <Pressable onPress={() => setTab("savings")}>
                <Text style={styles.mobileSectionLink}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.mobileGoalCard}>
              <Image source={goalIllustration1} style={styles.mobileGoalArt} resizeMode="cover" />
              <View style={styles.mobileGoalProgress}>
                <Text style={styles.mobileGoalProgressText}>
                  {featuredGoal
                    ? `${Math.min(100, Math.round((featuredGoal.currentAmount / featuredGoal.targetAmount) * 100))}%`
                    : "0%"}
                </Text>
              </View>
              <View style={styles.mobileGoalMain}>
                <Text style={styles.mobileGoalTitle}>{featuredGoal?.title ?? "No active goal yet"}</Text>
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

            <View style={[styles.homeLearningCard, styles.kidCardYellow]}>
              <View style={styles.homeLearningImages}>
                <Image source={learnIllustration1} style={styles.homeLearningImage} resizeMode="cover" />
                <Image source={learnIllustration2} style={[styles.homeLearningImage, styles.homeLearningImageRaised]} resizeMode="cover" />
                <Image source={learnIllustration3} style={styles.homeLearningImage} resizeMode="cover" />
              </View>
              <View style={styles.homeLearningContent}>
                <Text style={styles.webCardTitle}>Continue Learning</Text>
                <Text style={styles.rowMain}>{nextLearningLesson?.title ?? "Learn about money"}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {nextLearningLesson?.content ?? "Read fun lessons about saving, earning, and making smart money choices."}
                </Text>
                <Pressable style={styles.homeLearningButton} onPress={() => setTab("learn")}>
                  <Text style={styles.homeLearningButtonText}>Go to Learn & Earn</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.mobileTipCard, styles.kidCardPink]}>
              <Image source={choreIllustration1} style={styles.mobileTipImage} resizeMode="cover" />
              <Text style={styles.mobileTipTitle}>Daily Tip</Text>
              <Text style={styles.mobileTipText}>{dailyTip}</Text>
            </View>
          </Animated.View>
        ) : null}

        {tab === "home" && !isMobile ? (
          <View style={styles.webGridWrap}>
            <View style={styles.webMainCol}>
              <View style={[styles.webWalletHero, styles.webWalletHeroPlayful]}>
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

              <View style={[styles.webCard, styles.webCardGoalFun]}>
                <Image source={goalIllustration1} style={styles.webCardCornerImage} resizeMode="cover" />
                <Text style={styles.webCardTitle}>My Active Goal</Text>
                <View style={styles.webRowBetween}>
                  <View>
                    <Text style={styles.rowMain}>{featuredGoal?.title ?? "No active goal yet"}</Text>
                    <Text style={styles.rowMeta}>
                      {featuredGoal ? `${formatMoney(featuredGoal.currentAmount)} of ${formatMoney(featuredGoal.targetAmount)}` : "Create or continue an active savings goal"}
                    </Text>
                  </View>
                  <Text style={styles.webGoalPct}>{activeGoalProgress}%</Text>
                </View>
              </View>

              <View style={[styles.webCard, styles.webCardLearnFun]}>
                <Text style={styles.webCardTitle}>Continue Learning</Text>
                <View style={styles.homeLearningImages}>
                  <Image source={learnIllustration1} style={styles.homeLearningImage} resizeMode="cover" />
                  <Image source={learnIllustration2} style={[styles.homeLearningImage, styles.homeLearningImageRaised]} resizeMode="cover" />
                  <Image source={learnIllustration3} style={styles.homeLearningImage} resizeMode="cover" />
                </View>
                <Text style={styles.rowMain}>{nextLearningLesson?.title ?? "Learning about money"}</Text>
                <Text style={styles.rowMeta} numberOfLines={3}>
                  {nextLearningLesson?.content ?? "Learn how kids can save money, earn rewards, and make smart choices with every coin."}
                </Text>
                <Pressable style={styles.webMiniBtn} onPress={() => setTab("learn")}>
                  <Text style={styles.webMiniBtnText}>Go to Learn & Earn</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.webMidCol}>
              <View style={[styles.webCard, styles.webCardActionFun]}>
                <Text style={styles.webCardTitle}>Quick Actions</Text>
                <View style={styles.webQuickRow}>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("actions")}><Text style={styles.webQuickText}>Request Money</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("savings")}><Text style={styles.webQuickText}>My Goals</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("chores")}><Text style={styles.webQuickText}>My Chores</Text></Pressable>
                  <Pressable style={styles.webQuickItem} onPress={() => setTab("learn")}><Text style={styles.webQuickText}>Learn & Earn</Text></Pressable>
                </View>
              </View>
              <View style={[styles.webCard, styles.webCardChoreFun]}>
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
              <View style={[styles.webCard, styles.webCardTipFun]}>
                <Text style={styles.webCardTitle}>Daily Tip</Text>
                <Image source={walletIllustration2} style={styles.webSideImage} resizeMode="contain" />
                <Text style={styles.rowMeta}>{dailyTip}</Text>
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
                <Text style={styles.mobileLearnSubtitle}>Learn smart money skills and earn stars!</Text>
              </View>
              <View style={styles.mobileCoinsPill}>
                <Text style={styles.mobileCoinsValue}>{learningStarsEarned}</Text>
                <Text style={styles.mobileCoinsLabel}>Stars Earned</Text>
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
              <Text style={styles.mobileTipText}>Earn stars and unlock awesome rewards!</Text>
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "wallet" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileBalanceCard}>
              <Image source={walletIllustration4} style={styles.mobileBalanceMascot} resizeMode="contain" />
              <Text style={styles.mobileBalanceLabel}>My Wallet Balance</Text>
              <Text style={styles.mobileBalanceAmount}>{formatMoney(walletBalance)}</Text>
              <Text style={styles.mobileBalanceMeta}>Available Balance</Text>
            </View>

            <View style={[styles.softCard, styles.softCardMobile, styles.kidCardBlue]}>
              <View style={styles.mobileSectionHeader}>
                <Text style={styles.cardTitle}>Withdraw Money</Text>
                <Pressable style={styles.learningActionBtnPrimary} onPress={() => setShowWithdrawForm((prev) => !prev)}>
                  <Text style={styles.learningActionBtnPrimaryText}>{showWithdrawForm ? "Close" : "Withdraw"}</Text>
                </Pressable>
              </View>
              <Text style={styles.rowMeta}>Ask to use money from your wallet or a completed goal.</Text>
              {showWithdrawForm ? (
                <View style={styles.withdrawForm}>
                  <View style={styles.choiceRow}>
                    <Pressable style={[styles.choicePill, withdrawSource === "wallet" ? styles.choicePillActive : null]} onPress={() => setWithdrawSource("wallet")}>
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
                      {withdrawableCompletedGoals.length === 0 ? <Text style={styles.rowMeta}>No completed goals have money left to withdraw.</Text> : null}
                    </View>
                  ) : null}
                  <AppInput label="Amount (UGX)" value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="numeric" placeholder="10000" />
                  <AppInput label="Reason" value={withdrawDescription} onChangeText={setWithdrawDescription} placeholder="Optional" />
                  <AppButton title="Submit Withdrawal" loading={isSubmitting} onPress={handleCreateWithdrawal} />
                </View>
              ) : null}
            </View>

            <View style={[styles.softCard, styles.softCardMobile, styles.kidCardYellow]}>
              <Text style={styles.cardTitle}>Budgeting</Text>
              <Text style={styles.rowMeta}>{hasSavedBudget ? `${budget?.title ?? "Budget"} saved for this month.` : "Try 50% saving, 30% spending, 20% sharing."}</Text>
              <View style={styles.webBudgetRows}>
                <View style={styles.mobileBudgetRow}><Text style={styles.rowMain}>Save</Text><Text style={styles.rowMain}>{formatMoney(displayedBudget.saveAmount)}</Text></View>
                <View style={styles.mobileBudgetRow}><Text style={styles.rowMain}>Spend</Text><Text style={styles.rowMain}>{formatMoney(displayedBudget.spendAmount)}</Text></View>
                <View style={styles.mobileBudgetRow}><Text style={styles.rowMain}>Share</Text><Text style={styles.rowMain}>{formatMoney(displayedBudget.shareAmount)}</Text></View>
              </View>
              <View style={styles.webBudgetActions}>
                <Pressable style={[styles.webBudgetButton, isSubmitting && styles.disabledButton]} onPress={() => handleSaveBudgetPreset("smart")} disabled={isSubmitting}>
                  <Text style={styles.webBudgetButtonText}>Save 50/30/20</Text>
                </Pressable>
                <Pressable style={[styles.webBudgetButtonAlt, isSubmitting && styles.disabledButton]} onPress={() => handleSaveBudgetPreset("saveMore")} disabled={isSubmitting}>
                  <Text style={styles.webBudgetButtonAltText}>Save More</Text>
                </Pressable>
                {hasSavedBudget ? (
                  <Pressable style={[styles.learningActionBtn, isSubmitting && styles.disabledButton]} onPress={handleClearBudget} disabled={isSubmitting}>
                    <Text style={styles.learningActionBtnText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={[styles.softCard, styles.softCardMobile, styles.kidCardPink]}>
              <View style={styles.mobileSectionHeader}>
                <Text style={styles.cardTitle}>Recent Transactions</Text>
                <Pressable onPress={() => handleTabPress("transactions")}>
                  <Text style={styles.mobileSectionLink}>View All</Text>
                </Pressable>
              </View>
              {transactions.slice(0, 4).map((tx) => (
                <View key={tx.id} style={[styles.rowItem, styles.rowItemMobile]}>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowMain}>{tx.description || (tx.type === "earn" ? "Money In" : "Money Out")}</Text>
                    <Text style={styles.rowMeta}>{new Date(tx.createdAt).toLocaleDateString()} - {tx.status}</Text>
                  </View>
                  <Text style={[styles.rowMeta, tx.type === "earn" ? styles.tableCellSuccess : styles.tableCellPending]}>{tx.type === "earn" ? "+" : "-"} {formatMoney(tx.amount)}</Text>
                </View>
              ))}
              {transactions.length === 0 ? <Text style={styles.infoText}>No transactions yet.</Text> : null}
            </View>
          </View>
        ) : null}
        {tab === "wallet" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webWalletTopGrid}>
              <View style={[styles.webWalletHero, styles.webWalletHeroPlayful]}>
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
                  <Text style={styles.webWalletStat}>Savings {formatMoney(totalSavings)}</Text>
                </View>
              </View>

              <View style={[styles.webWalletHero, styles.webWithdrawHero]}>
                <View style={styles.webRowBetween}>
                  <View>
                    <Text style={styles.webWalletTitle}>Withdraw Money</Text>
                    <Text style={styles.webWalletLabel}>Ask to use your saved money</Text>
                  </View>
                  <Pressable style={styles.webWithdrawToggle} onPress={() => setShowWithdrawForm((prev) => !prev)}>
                    <Text style={styles.webWithdrawToggleText}>{showWithdrawForm ? "Close" : "Withdraw"}</Text>
                  </Pressable>
                </View>
                <Image source={walletIllustration5} style={styles.webWithdrawImage} resizeMode="contain" />
                {showWithdrawForm ? (
                  <View style={styles.withdrawForm}>
                    <Text style={styles.webWalletStat}>Where do you want to withdraw from?</Text>
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
                          <Text style={styles.webWalletStat}>No completed goals have money left to withdraw.</Text>
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
                  <View style={styles.webWalletStats}>
                    <Text style={styles.webWalletStat}>From wallet or completed goals</Text>
                    <Text style={styles.webWalletStat}>Parent approval may be needed</Text>
                  </View>
                )}
              </View>

              <View style={[styles.webWalletHero, styles.webBudgetHero]}>
                <View style={styles.webRowBetween}>
                  <View>
                    <Text style={styles.webWalletTitle}>Budgeting</Text>
                    <Text style={styles.webWalletLabel}>Plan your money before spending</Text>
                  </View>
                  <Image source={moneyIllustration1} style={styles.webBudgetIcon} resizeMode="cover" />
                </View>
                <View style={styles.webBudgetRows}>
                  <View style={styles.webBudgetRow}>
                    <Text style={styles.webBudgetLabel}>Save</Text>
                    <Text style={styles.webBudgetValue}>{formatMoney(displayedBudget.saveAmount)}</Text>
                  </View>
                  <View style={styles.webBudgetRow}>
                    <Text style={styles.webBudgetLabel}>Spend</Text>
                    <Text style={styles.webBudgetValue}>{formatMoney(displayedBudget.spendAmount)}</Text>
                  </View>
                  <View style={styles.webBudgetRow}>
                    <Text style={styles.webBudgetLabel}>Share</Text>
                    <Text style={styles.webBudgetValue}>{formatMoney(displayedBudget.shareAmount)}</Text>
                  </View>
                </View>
                <View style={styles.mobileGoalTrack}>
                  <View style={[styles.mobileGoalTrackFill, styles.webBudgetSaveFill, { width: hasSavedBudget ? "100%" : "50%" }]} />
                </View>
                <View style={styles.webBudgetActions}>
                  <Pressable style={[styles.webBudgetButton, isSubmitting && styles.disabledButton]} onPress={() => handleSaveBudgetPreset("smart")} disabled={isSubmitting}>
                    <Text style={styles.webBudgetButtonText}>Save 50/30/20</Text>
                  </Pressable>
                  <Pressable style={[styles.webBudgetButtonAlt, isSubmitting && styles.disabledButton]} onPress={() => handleSaveBudgetPreset("saveMore")} disabled={isSubmitting}>
                    <Text style={styles.webBudgetButtonAltText}>Save More</Text>
                  </Pressable>
                  {hasSavedBudget ? (
                    <Pressable style={[styles.webBudgetButtonGhost, isSubmitting && styles.disabledButton]} onPress={handleClearBudget} disabled={isSubmitting}>
                      <Text style={styles.webBudgetButtonGhostText}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.webWalletStat}>{hasSavedBudget ? `${budget?.title ?? "Budget"} saved for this month.` : "Try 50% saving, 30% spending, 20% sharing."}</Text>
              </View>
            </View>

            <View style={styles.webWalletTransactionsGrid}>
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

            </View>
          </View>
        ) : null}

        {!isLoading && tab === "learn" && !isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.webTopRow}>
              <View>
                <Text style={styles.webHello}>Learn & Earn</Text>
                <Text style={styles.webHelloSub}>Learn smart money skills and earn stars!</Text>
              </View>
            </View>

            <View style={styles.webGoalsTopGrid}>
              <View style={styles.webGoalsBanner}>
                <Text style={styles.webGoalsBannerText}>Keep learning, keep growing! Every lesson makes you smarter.</Text>
                  </View>
                  <View style={styles.webGoalsKpiRow}>
                <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Stars Earned</Text><Text style={styles.webKpiValue}>{learningStarsEarned}</Text></View>
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
                  </View>
                  <View style={styles.webGoalsKpiRow}>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Money In</Text><Text style={styles.tableCellSuccess}>{formatMoney(totalMoneyIn)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Money Out</Text><Text style={styles.tableCellPending}>{formatMoney(totalMoneyOut)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Net Balance</Text><Text style={styles.webKpiValue}>{formatMoney(netBalance)}</Text></View>
              <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Total Transactions</Text><Text style={styles.webKpiValue}>{transactions.length}</Text></View>
            </View>

            <View style={styles.webWalletTransactionsGrid}>
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

            </View>
          </View>
        ) : null}

        {!isLoading && tab === "notifications" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileSectionHeader}>
              <View>
                <Text style={styles.mobileSectionTitle}>Notifications</Text>
                <Text style={styles.rowMeta}>Wallet, chores, and goal updates</Text>
              </View>
              <Text style={styles.mobileSectionLink}>{unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : "All read"}</Text>
            </View>
            <View style={[styles.softCard, styles.softCardMobile, styles.kidCardBlue]}>
              {notificationItems.map((item) => (
                <View key={item.id} style={[styles.rowItem, styles.rowItemMobile, item.isRead ? null : styles.notificationUnreadRow]}>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowMain}>{item.title}</Text>
                    <Text style={styles.rowMeta}>{item.message}</Text>
                  </View>
                  <Text style={[styles.rowMeta, styles.rowMetaRightMobile]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
              ))}
              {notificationItems.length === 0 ? <Text style={styles.infoText}>No notifications yet.</Text> : null}
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
              {notificationItems.map((item) => (
                <View key={item.id} style={styles.webProfileRow}>
                  <View>
                    <Text style={styles.rowMain}>{item.title}</Text>
                    <Text style={styles.rowMeta}>{item.message}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
              ))}
              {notificationItems.length === 0 ? <Text style={styles.infoText}>No notifications yet.</Text> : null}
            </View>
          </View>
        ) : null}

        {!isLoading && tab === "savings" && isMobile ? (
          <View style={styles.sectionWrap}>
            <View style={styles.mobileSectionHeader}>
              <Text style={styles.mobileSectionTitle}>My Active Goals</Text>
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
              <Pressable style={styles.webMiniBtn} onPress={() => setTab("actions")}>
                  <Text style={styles.webMiniBtnText}>Create New Goal</Text>
                </Pressable>
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
                  <Text style={styles.achievementIcon}>{goldenStarCount > 0 ? "\u2605" : "\u25CE"}</Text>
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
                    <Text style={styles.mobileLessonIcon}>{"\u{1F4CB}"}</Text>
                  </View>
                  <View style={styles.mobileContinueMain}>
                    <Text style={styles.rowMain}>{chore.title}</Text>
                    <Text style={styles.rowMeta}>{chore.description ?? "Complete this task and earn rewards."}</Text>
                    <Text style={styles.mobileAmountPositive}>{"\u{1F4B0}"} {formatMoney(chore.rewardAmount)}</Text>
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
                    <Text style={styles.mobileLessonIcon}>{"\u{1F4CB}"}</Text>
                  </View>
                  <View style={styles.mobileContinueMain}>
                    <Text style={styles.rowMain}>{chore.title}</Text>
                    <Text style={styles.rowMeta}>{chore.description ?? "Completed chore"}</Text>
                    <Text style={styles.mobileAmountPositive}>{"\u{1F4B0}"} {formatMoney(chore.rewardAmount)}</Text>
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

            <View style={styles.webWalletTransactionsGrid}>
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
              <Text style={styles.cardTitle}>Create Goal</Text>
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
                {resolvedSidebarAvatarUri ? (
                  <Image key={resolvedSidebarAvatarUri} source={{ uri: resolvedSidebarAvatarUri }} style={styles.mobileProfileAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.mobileProfileAvatarText}>{childDisplayName[0]?.toUpperCase() ?? "?"}</Text>
                )}
              </View>
              <View style={styles.mobileProfileMeta}>
                <Text style={styles.mobileProfileName}>{childDisplayName}</Text>
                <Text style={styles.mobileProfileLevel}>{childAge ? `${childAge} years old` : "Kids Account"}</Text>
                <Text style={styles.mobileProfileXp}>{totalStarsEarned} stars earned</Text>
                <View style={styles.mobileProfileXpTrack}>
                  <View style={[styles.mobileProfileXpFill, { width: `${Math.min(100, totalStarsEarned * 12)}%` }]} />
                </View>
                <Pressable style={styles.profilePhotoButton} onPress={handlePickProfileImage} disabled={isSubmitting}>
                  <Text style={styles.profilePhotoButtonText}>Change Profile Picture</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.profileStatsGrid}>
              <View style={styles.profileStatTile}><Text style={styles.webKpiValue}>{totalStarsEarned}</Text><Text style={styles.rowMeta}>Stars</Text></View>
              <View style={styles.profileStatTile}><Text style={styles.webKpiValue}>{quizzesPassed}</Text><Text style={styles.rowMeta}>Quizzes Passed</Text></View>
              <View style={styles.profileStatTile}><Text style={styles.webKpiValue}>{rewardsGotten}</Text><Text style={styles.rowMeta}>Rewards</Text></View>
              <View style={styles.profileStatTile}><Text style={styles.webKpiValue}>{completedLearningCount}</Text><Text style={styles.rowMeta}>Lessons</Text></View>
            </View>

            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>About Me</Text>
              <Text style={styles.rowMeta}>{childAboutMe?.trim() || "Write something fun about yourself."}</Text>
              <AppInput label="My About Me" value={aboutMeDraft} onChangeText={setAboutMeDraft} multiline numberOfLines={4} placeholder="I like saving for toys, learning money skills..." />
              <AppButton title="Save About Me" loading={isSubmitting} onPress={handleSaveAboutMe} />
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
                <Text style={styles.webHelloSub}>About {childDisplayName}, achievements, and rewards.</Text>
              </View>
            </View>

            <View style={styles.webWalletBottomGrid}>
              <View style={styles.webMainCol}>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <View>
                      <Text style={styles.webHello}>{childDisplayName}</Text>
                      <Text style={styles.webHelloSub}>{childAge ? `${childAge} years old` : "Kids Account"}</Text>
                      <Text style={styles.webHelloSub}>{email}</Text>
                    </View>
                    <View style={styles.profileAvatarFrame}>
                      {resolvedSidebarAvatarUri ? (
                        <Image key={resolvedSidebarAvatarUri} source={{ uri: resolvedSidebarAvatarUri }} style={styles.profileAvatarImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.profileAvatarPlaceholder}>
                          <Text style={styles.webSidebarAvatarInitial}>{childDisplayName[0]?.toUpperCase() ?? "?"}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable style={styles.profilePhotoButton} onPress={handlePickProfileImage} disabled={isSubmitting}>
                    <Text style={styles.profilePhotoButtonText}>Change Profile Picture</Text>
                  </Pressable>
                  <View style={styles.webGoalsKpiRow}>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Stars Earned</Text><Text style={styles.webKpiValue}>{totalStarsEarned}</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Quizzes Passed</Text><Text style={styles.webKpiValue}>{quizzesPassed}</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Rewards Gotten</Text><Text style={styles.webKpiValue}>{rewardsGotten}</Text></View>
                    <View style={styles.webGoalsKpiCard}><Text style={styles.webKpiLabel}>Lessons Completed</Text><Text style={styles.webKpiValue}>{completedLearningCount}</Text></View>
                  </View>
                </View>

                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>About Me</Text>
                  <Text style={styles.rowMeta}>{childAboutMe?.trim() || "Write something fun about yourself so your profile feels like you."}</Text>
                  <AppInput label="My About Me" value={aboutMeDraft} onChangeText={setAboutMeDraft} multiline numberOfLines={5} placeholder="I like learning, saving, helping at home..." />
                  <AppButton title="Save About Me" loading={isSubmitting} onPress={handleSaveAboutMe} />
                </View>
              </View>

              <View style={styles.webMidCol}>
                <View style={styles.webCard}>
                  <View style={styles.webRowBetween}>
                    <Text style={styles.webCardTitle}>My Badges</Text>
                    <Text style={styles.mobileSectionLink}>{achievements.length} earned</Text>
                  </View>
                  <View style={styles.badgesRow}>
                    {badgeCatalog.map((badge) => (
                      <View key={badge.key} style={[styles.badgeTile, badge.unlocked ? styles.badgeTileUnlocked : styles.badgeTileLocked]}>
                        <Text style={[styles.badgeIcon, badge.unlocked ? null : styles.badgeIconLocked]}>{badge.icon}</Text>
                        <View style={styles.badgeTextWrap}>
                          <Text style={styles.badgeTitleText}>{badge.title}</Text>
                          <Text style={styles.badgeDescription}>{badge.unlocked ? "Unlocked" : badge.description}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Rewards Gotten</Text>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{formatMoney(totalChoreRewards)}</Text><Text style={styles.rowMeta}>Chore reward money</Text></View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{achievements.length}</Text><Text style={styles.rowMeta}>Badges and stars</Text></View>
                  <View style={styles.webProfileStatCard}><Text style={styles.webKpiValue}>{completedGoalsCount}</Text><Text style={styles.rowMeta}>Goals reached</Text></View>
                </View>
              </View>

              <View style={styles.webRightCol}>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Learning Progress</Text>
                  <Text style={styles.webAllowanceValue}>{learningProgressPercent}%</Text>
                  <Text style={styles.rowMeta}>overall learning progress</Text>
                </View>
                <View style={styles.webCard}>
                  <Text style={styles.webCardTitle}>Keep up the great work, {childDisplayName}!</Text>
                  <Text style={styles.rowMeta}>You are learning, earning stars, and growing every day.</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {isMobile ? (
        <View style={[styles.mobileBottomNav, { bottom: 8 + mobileBottomInset }]}>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "home" ? styles.mobileBottomNavItemActive : null,
              tab === "home" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => handleTabPress("home")}
          >
            <Image source={moneyIllustration1} style={styles.mobileBottomNavImage} resizeMode="cover" />
            <Text style={[styles.mobileBottomNavText, tab === "home" ? styles.mobileBottomNavTextActive : null]}>Home</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "learn" ? styles.mobileBottomNavItemActive : null,
              tab === "learn" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => handleTabPress("learn")}
          >
            <Image source={learnIllustration1} style={styles.mobileBottomNavImage} resizeMode="cover" />
            <Text style={[styles.mobileBottomNavText, tab === "learn" ? styles.mobileBottomNavTextActive : null]}>Learn</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "savings" ? styles.mobileBottomNavItemActive : null,
              tab === "savings" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => handleTabPress("savings")}
          >
            <Image source={goalIllustration1} style={styles.mobileBottomNavImage} resizeMode="cover" />
            <Text style={[styles.mobileBottomNavText, tab === "savings" ? styles.mobileBottomNavTextActive : null]}>Goals</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "chores" ? styles.mobileBottomNavItemActive : null,
              tab === "chores" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => handleTabPress("chores")}
          >
            <Image source={choreIllustration1} style={styles.mobileBottomNavImage} resizeMode="cover" />
            <Text style={[styles.mobileBottomNavText, tab === "chores" ? styles.mobileBottomNavTextActive : null]}>Chores</Text>
          </AnimatedTileButton>
          <AnimatedTileButton
            style={[
              styles.mobileBottomNavItem,
              tab === "settings" ? styles.mobileBottomNavItemActive : null,
              tab === "settings" ? { transform: [{ scale: activeTabAnim }] } : null,
            ]}
            onPress={() => handleTabPress("settings")}
          >
            <Image source={learnIllustration3} style={styles.mobileBottomNavImage} resizeMode="cover" />
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
  mobileSidebarBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 16, 45, 0.5)",
    zIndex: 40,
  },
  mobileSidebarBackdropTap: {
    flex: 1,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eef9ff",
  },
  contentCardInner: {
    padding: 14,
    gap: 12,
    overflow: "hidden",
  },
  contentCardMobile: {
    borderRadius: 14,
    backgroundColor: "#fff7d6",
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
    overflow: "hidden",
  },
  mobileAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  mobileMenuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#ffd54a",
  },
  mobileMenuLine: {
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#5b35dc",
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
    fontSize: 22,
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
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 214, 102, 0.7)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    padding: 10,
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
    paddingVertical: 12,
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
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#c4b5fd",
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
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fde68a",
    backgroundColor: "#fff7ed",
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
    borderRadius: 16,
    backgroundColor: "#fff1b8",
    borderWidth: 2,
    borderColor: "#facc15",
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
    borderRadius: 20,
    backgroundColor: "#e0f7ff",
    borderWidth: 2,
    borderColor: "#7dd3fc",
    padding: 16,
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
  homeLearningCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6e9f5",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 12,
  },
  homeLearningImages: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  homeLearningImage: {
    flex: 1,
    minWidth: 0,
    height: 72,
    borderRadius: 10,
  },
  homeLearningImageRaised: {
    height: 84,
  },
  homeLearningContent: {
    gap: 6,
  },
  homeLearningButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#5f46f1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  homeLearningButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
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
  mobileProfileAvatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
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
  profileAvatarFrame: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: "#ffcf4a",
    overflow: "hidden",
    backgroundColor: "#ffdc5e",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffdc5e",
  },
  profilePhotoButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ffcf4a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  profilePhotoButtonText: {
    color: "#16205f",
    fontSize: 12,
    fontWeight: "900",
  },
  profileStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  profileStatTile: {
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2f66",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 4,
  },  mobileProfileMenu: {
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
    width: 212,
    borderRadius: 20,
    backgroundColor: "#5b35dc",
    padding: 10,
    gap: 8,
  },
  webSidebarMobileDrawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 276,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 14,
    zIndex: 50,
    elevation: 18,
    shadowColor: "#1b1748",
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 5, height: 0 },
  },
  webBrandWrapMobile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mobileSidebarCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  mobileSidebarCloseText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },  webBrandWrap: {
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#7c6bff",
  },
  webSidebarProfile: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#7c6bff",
    gap: 6,
  },
  webSidebarAvatarOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: "#ffd54a",
    overflow: "hidden",
    backgroundColor: "#ffdc5e",
  },
  webSidebarAvatarImage: {
    width: "100%",
    height: "100%",
  },
  webSidebarAvatarPlaceholder: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffdc5e",
  },
  webSidebarAvatarInitial: {
    color: "#eaf0ff",
    fontSize: 22,
    fontWeight: "800",
  },
  webSidebarChildName: {
    color: "#eaf0ff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  webBrand: {
    color: "#fff7b0",
    fontWeight: "900",
    fontSize: 26,
  },
  webNavList: {
    gap: 4,
    flex: 1,
  },
  webNavItem: {
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  webNavItemActive: {
    backgroundColor: "#ff8a1f",
    borderColor: "#ffd54a",
  },
  webNavIconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6e54e8",
  },
  webNavIconPillActive: {
    backgroundColor: "#ffffff",
  },
  webNavIcon: {
    color: "#b8c3ff",
    fontSize: 13,
    fontWeight: "900",
  },
  webNavIconEmoji: {
    fontSize: 14,
    lineHeight: 16,
    textAlign: "center",
  },
  webNavIconActive: {
    color: "#5f46f1",
  },
  webNavText: {
    flex: 1,
    color: "#d7deff",
    fontWeight: "700",
    fontSize: 13,
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
    paddingVertical: 8,
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
  badgesSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "rgba(255, 251, 235, 0.96)",
    padding: 14,
    gap: 12,
    zIndex: 2,
  },
  badgesSectionMobile: {
    marginBottom: 4,
  },
  badgesTitle: {
    color: "#7c2d12",
    fontSize: 18,
    fontWeight: "900",
  },
  badgesSubtitle: {
    color: "#9a5b16",
    fontSize: 12,
    fontWeight: "700",
  },
  badgesSparkle: {
    fontSize: 24,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeTile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badgeTileUnlocked: {
    backgroundColor: "#ffffff",
    borderColor: "#facc15",
  },
  badgeTileLocked: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    opacity: 0.72,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeIconLocked: {
    opacity: 0.38,
  },
  badgeTextWrap: {
    flex: 1,
    gap: 2,
  },
  badgeTitleText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "900",
  },
  badgeDescription: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  webCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffd6a5",
    backgroundColor: "rgba(255, 253, 247, 0.96)",
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
    gap: 12,
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
  webWalletTransactionsGrid: {
    gap: 10,
    alignItems: "stretch",
  },
  webWalletRightCol: {
    width: 280,
    gap: 10,
  },
  webTxHeader: {
    width: "100%",
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  webTxHeadCell: {
    flex: 1,
    color: "#67708f",
    fontSize: 11,
    fontWeight: "700",
  },
  webTxRow: {
    width: "100%",
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    paddingHorizontal: 8,
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
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#ffb3d1",
    backgroundColor: "#fff0f7",
    padding: 16,
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#99f6e4",
    backgroundColor: "#ecfeff",
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
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
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffd166",
    backgroundColor: "#fff7cc",
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
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
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
  notificationUnreadRow: {
    borderColor: "#ffd54a",
    backgroundColor: "#fff8d7",
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
    minHeight: 76,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#ffd54a",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  mobileBottomNavItem: {
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minWidth: 58,
    borderWidth: 1,
    borderColor: "#f2e8ff",
  },
  mobileBottomNavItemActive: {
    backgroundColor: "#fff0c2",
    borderColor: "#ffb84d",
  },
  mobileBottomNavIcon: {
    fontSize: 20,
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
  mobileBalanceMascot: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 126,
    height: 126,
    opacity: 0.92,
  },
  mobileServiceItemMoney: { backgroundColor: "#dcfce7" },
  mobileServiceItemRequest: { backgroundColor: "#e0f2fe" },
  mobileServiceItemGoals: { backgroundColor: "#fef3c7" },
  mobileServiceItemChores: { backgroundColor: "#fae8ff" },
  kidCardBlue: {
    backgroundColor: "#f1fbff",
    borderColor: "#bfeeff",
  },
  kidCardYellow: {
    backgroundColor: "#fff8d7",
    borderColor: "#ffe08a",
  },
  kidCardPink: {
    backgroundColor: "#fff1f7",
    borderColor: "#ffc9df",
  },
  mobileBudgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,213,74,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },  mobileGoalArt: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  mobileTipImage: {
    width: "100%",
    height: 94,
    borderRadius: 14,
  },
  webWalletHeroPlayful: {
    shadowColor: "#6a43f4",
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  webCardGoalFun: {
    backgroundColor: "#f4edff",
    borderColor: "#d8c9ff",
    overflow: "hidden",
  },
  webCardLearnFun: {
    backgroundColor: "#fff8d7",
    borderColor: "#ffe08a",
  },
  webCardActionFun: {
    backgroundColor: "#e7f8ff",
    borderColor: "#bfeeff",
  },
  webCardChoreFun: {
    backgroundColor: "#fff1f7",
    borderColor: "#ffc9df",
  },
  webCardTipFun: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  webCardCornerImage: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 76,
    height: 76,
    borderRadius: 18,
    opacity: 0.28,
  },
  webAvatarTrail: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  webAvatarTrailImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#fff7b0",
  },
  mobileHeaderArt: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffffff",
    marginLeft: "auto",
    marginRight: 8,
  },
  webTopArt: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  mobileBottomNavImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  webWithdrawHero: {
    backgroundColor: "#ff8a1f",
    borderColor: "#ffe08a",
  },
  webWithdrawToggle: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webWithdrawToggleText: {
    color: "#9a3412",
    fontWeight: "900",
    fontSize: 12,
  },
  webWithdrawImage: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 118,
    height: 118,
    opacity: 0.28,
  },
  webBudgetHero: {
    backgroundColor: "#22c55e",
    borderColor: "#bbf7d0",
  },
  webBudgetIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  webBudgetRows: {
    gap: 8,
  },
  webBudgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webBudgetLabel: {
    color: "#ecfdf5",
    fontWeight: "900",
    fontSize: 13,
  },
  webBudgetValue: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  webBudgetSaveFill: {
    backgroundColor: "#facc15",
  },
  webBudgetActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  webBudgetButton: {
    backgroundColor: "#facc15",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  webBudgetButtonAlt: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  webBudgetButtonGhost: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  webBudgetButtonText: {
    color: "#14532d",
    fontWeight: "900",
    fontSize: 12,
  },
  webBudgetButtonAltText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 12,
  },
  webBudgetButtonGhostText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
});


























