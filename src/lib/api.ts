export type UserRole = "parent" | "child" | "admin";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  nin: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginResponse = {
  message: string;
  role: UserRole;
  token?: string;
};

export type AuthMeResponse = {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
};

export type WalletSummary = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
};

export type SavingsGoalSummary = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  status: string;
  targetDate: string | null;
  completedAt: string | null;
};

export type ChildAchievementSummary = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  unlockedAt: string | null;
};

export type TransactionSummary = {
  id: string;
  amount: number;
  type: "earn" | "spend";
  status: "approved" | "pending" | "declined";
  description: string | null;
  createdAt: string;
};

export type ChoreSummary = {
  id: string;
  title: string;
  description: string | null;
  rewardAmount: number;
  dueDate: string | null;
  status: "assigned" | "completed";
  completedAt: string | null;
};

export type AllowanceSummary = {
  id: string;
  title: string;
  amount: number;
  availableOn: string;
  notes: string | null;
  isActive: boolean;
};

export type ParentChildSummary = {
  id: string;
  nickname: string;
  age: number;
  email: string;
  wallet: WalletSummary | null;
  activeSpendingLimit: number | null;
  activeSpendingLimitPeriod: "weekly" | "monthly" | "quarterly" | null;
};

export type ParentPendingTransaction = {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  type: "earn" | "spend";
  status: "pending";
  description: string | null;
  createdAt: string;
};

export type ParentTransactionSummary = {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  type: "earn" | "spend";
  status: "pending" | "approved" | "rejected";
  description: string | null;
  createdAt: string;
};

export type ParentSavingsGoalSummary = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  status: string;
  targetDate: string | null;
  completedAt: string | null;
};

export type ParentChoreSummary = {
  id: string;
  title: string;
  description: string | null;
  rewardAmount: number;
  dueDate: string | null;
  status: "assigned" | "completed";
  completedAt: string | null;
  childId: string;
  childName: string;
};

export type ParentAllowanceSummary = {
  id: string;
  title: string;
  amount: number;
  availableOn: string;
  notes: string | null;
  isActive: boolean;
  childId: string;
  childName: string;
};

export type ParentProfile = {
  fullName: string;
  nin: string;
  phoneNumber: string;
  email: string;
};

export type AdminAnalytics = {
  totalParents: number;
  totalChildren: number;
  totalTransactions: number;
  pendingTransactions: number;
  approvedTransactions: number;
  totalLessons: number;
  totalQuizzes: number;
  earnCount: number;
  spendCount: number;
};

export type AdminLesson = {
  id: string;
  title: string;
  content: string;
  resourceType: "text" | "pdf" | "video";
  resourceUrl: string | null;
  fileName: string | null;
  isPublished: boolean;
  createdAt: string;
};

export type AdminQuiz = {
  id: string;
  title: string;
  isPublished: boolean;
  createdAt: string;
};

export type ChildLearningLesson = {
  assignmentId: string;
  lessonId: string;
  title: string;
  content: string;
  resourceType: "text" | "pdf" | "video";
  resourceUrl: string | null;
  fileName: string | null;
  status: string;
  progressPercent: number;
  studyDays: number;
  studyStartAt: string | null;
  studyEndAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  completedAt: string | null;
  assignedAt: string;
};

export type ParentLearningAssignment = {
  assignmentId: string;
  childId: string;
  childName: string;
  lessonId: string;
  lessonTitle: string;
  resourceType: "text" | "pdf" | "video";
  status: string;
  progressPercent: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  completedAt: string | null;
  assignedAt: string;
};

export type AdminOverviewData = {
  totalAmountTransacted: number;
  activitySeries: number[];
  approvalSeries: number[];
  categoryBreakdown: Array<{
    label: string;
    amount: number;
    percent: number;
  }>;
  recentTransactions: Array<{
    id: string;
    childName: string;
    type: "earn" | "spend";
    category: string;
    amount: number;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
  }>;
  topSavingGoals: Array<{
    id: string;
    title: string;
    childName: string;
    currentAmount: number;
    targetAmount: number;
  }>;
  supportTickets: Array<{
    id: string;
    issueType: string;
    status: string;
    createdAt: string;
  }>;
  criticalAlerts: Array<{
    id: string;
    title: string;
    detail: string;
    severity: "danger" | "warning" | "info";
    createdAt: string;
  }>;
  newUsersThisMonth: number;
};

export type AdminParentUsersData = {
  summary: {
    totalParents: number;
    totalChildrenLinked: number;
    totalBalanceHeld: number;
    totalParentDeposits: number;
    totalDepositTransactions: number;
    openSupportTickets: number;
    pendingTransactions: number;
  };
  parents: Array<{
    id: string;
    fullName: string;
    email: string;
    childCount: number;
    accountBalance: number;
    totalDeposited: number;
    openTicketCount: number;
  }>;
};

export type AdminChildUsersData = {
  summary: {
    totalChildren: number;
    totalWalletBalance: number;
    pendingApprovals: number;
    approvedEarn: number;
    approvedSpend: number;
    goalsCompleted: number;
    choresCompleted: number;
  };
  children: Array<{
    id: string;
    nickname: string;
    age: number;
    parentName: string;
    walletBalance: number;
    totalEarned: number;
    totalSpent: number;
  }>;
};

export type ParentPreferences = {
  withdrawalApprovalRequired: boolean;
  accountFreezeEnabled: boolean;
  merchantRestrictions: string;
  quietHours: string;
  notifyDeposits: boolean;
  notifyWithdrawals: boolean;
  notifySuspiciousLogins: boolean;
  notifyGoals: boolean;
};

export type ParentNotification = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export type ParentReportSummary = {
  parent: {
    currentBalance: number;
    totalDeposited: number;
    depositTransactions: number;
    totalDepositAmount: number;
    reservedForActiveAllowances: number;
    totalSentToChildren: number;
  };
  children: {
    childCount: number;
    approvedCount: number;
    pendingCount: number;
    totalSpent: number;
    totalEarned: number;
    walletBalance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    goalsCompleted: number;
    choresCompleted: number;
  };
};

export type ParentSupportTicket = {
  id: string;
  issueType: string;
  message: string;
  status: string;
  createdAt: string;
};

export type ParentAccountBalance = {
  balance: number;
  totalDeposited: number;
};

export type ParentReportExportType =
  | "parent-summary"
  | "children-overview"
  | "transactions"
  | "goals"
  | "chores"
  | "allowances"
  | "learning"
  | "support"
  | "full-export";
export type StatementIncludeField = "date" | "child" | "type" | "status" | "description" | "amount";

const fallbackBaseUrl = "http://localhost:3000";
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || fallbackBaseUrl;

export const API_BASE_URL = configuredBaseUrl.endsWith("/")
  ? configuredBaseUrl.slice(0, -1)
  : configuredBaseUrl;

// Set this after Firebase sign-in: setAuthToken(await firebaseUser.getIdToken())
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const fallbackMessage = text.trim() || `Request failed (${response.status})`;
    throw new Error((payload.error as string) ?? (payload.message as string) ?? fallbackMessage);
  }

  return payload as TResponse;
}

export function apiLogin(input: LoginRequest) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiRegister(input: RegisterRequest) {
  return request<{ message: string; userId: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiMe() {
  return request<AuthMeResponse>("/api/auth/me", {
    method: "GET",
  });
}

export function apiLogout() {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function apiChildWallet() {
  return request<{ wallet: WalletSummary; savingsGoals: SavingsGoalSummary[]; achievements: ChildAchievementSummary[] }>("/api/child/wallet", {
    method: "GET",
  });
}

export function apiChildTransactions() {
  return request<{ transactions: TransactionSummary[] }>("/api/child/transactions", {
    method: "GET",
  });
}

export function apiCreateChildTransaction(input: {
  amount: number;
  type: "earn" | "spend";
  description?: string;
}) {
  return request<{ message: string; transactionId: string; status: string }>("/api/child/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiChildSavingsGoals() {
  return request<{ savingsGoals: SavingsGoalSummary[] }>("/api/child/savings-goals", {
    method: "GET",
  });
}

export function apiCreateChildSavingsGoal(input: {
  title: string;
  targetAmount: number;
  targetDate?: string;
}) {
  return request<{ message: string }>("/api/child/savings-goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiFundChildGoal(input: { goalId: string; amount: number }) {
  return request<{
    message: string;
    wallet: WalletSummary;
    goal: SavingsGoalSummary;
  }>("/api/child/savings-goals/fund", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiCreateChildWithdrawal(input: {
  source: "wallet" | "goal";
  amount: number;
  goalId?: string;
  description?: string;
}) {
  return request<{
    message: string;
    transactionId: string;
    status: string;
    wallet: WalletSummary;
    goal: SavingsGoalSummary | null;
  }>("/api/child/withdrawals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiChildChores() {
  return request<{ chores: ChoreSummary[] }>("/api/child/chores", {
    method: "GET",
  });
}

export function apiCompleteChildChore(choreId: string) {
  return request<{ message: string }>(`/api/child/chores/${encodeURIComponent(choreId)}/complete`, {
    method: "POST",
  });
}

export function apiChildAllowances() {
  return request<{ allowances: AllowanceSummary[] }>("/api/child/allowances", {
    method: "GET",
  });
}

export function apiChangePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return request<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentChildren() {
  return request<{ children: ParentChildSummary[] }>("/api/parent/children", {
    method: "GET",
  });
}

export function apiCreateParentChild(input: {
  fullName: string;
  email: string;
  password: string;
  nickname: string;
  age: number;
}) {
  return request<{ message: string; childId: string }>("/api/parent/children", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentPendingTransactions() {
  return request<{ pending: ParentPendingTransaction[] }>("/api/parent/transactions/pending", {
    method: "GET",
  });
}

export function apiParentTransactionDecision(id: string, decision: "approved" | "rejected") {
  return request<{ message: string }>(`/api/parent/transactions/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export function apiParentSpendingLimit(input: {
  childId: string;
  monthlyLimit: number;
  periodType: "weekly" | "monthly" | "quarterly";
}) {
  return request<{ message: string }>("/api/parent/spending-limit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentChores() {
  return request<{ chores: ParentChoreSummary[] }>("/api/parent/chores", {
    method: "GET",
  });
}

export function apiCreateParentChore(input: {
  childId: string;
  title: string;
  description?: string;
  rewardAmount?: number;
  dueDate?: string;
}) {
  return request<{ message: string }>("/api/parent/chores", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentAllowances() {
  return request<{ allowances: ParentAllowanceSummary[] }>("/api/parent/allowances", {
    method: "GET",
  });
}

export function apiCreateParentAllowance(input: {
  childId: string;
  title: string;
  amount: number;
  availableOn: string;
  notes?: string;
}) {
  return request<{ message: string; parentBalance?: number }>("/api/parent/allowances", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiDeleteParentAllowance(id: string) {
  return request<{ message: string; parentBalance?: number }>(`/api/parent/allowances/${id}`, {
    method: "DELETE",
  });
}

export function apiUpdateParentAllowance(
  id: string,
  input: {
    childId: string;
    title: string;
    amount: number;
    availableOn: string;
    notes?: string;
  }
) {
  return request<{ message: string; parentBalance?: number }>(`/api/parent/allowances/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function apiUpdateParentAccount(input: ParentProfile) {
  return request<{ message: string; profile: ParentProfile }>("/api/parent/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function apiParentChangeChildPassword(
  childId: string,
  input: {
    newPassword: string;
    confirmPassword: string;
  }
) {
  return request<{ message: string }>(`/api/parent/children/${encodeURIComponent(childId)}/password`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function apiAdminAnalytics() {
  return request<AdminAnalytics>("/api/admin/analytics", {
    method: "GET",
  });
}

export function apiAdminOverview() {
  return request<AdminOverviewData>("/api/admin/overview", {
    method: "GET",
  });
}

export function apiAdminParentUsers() {
  return request<AdminParentUsersData>("/api/admin/users/parents", {
    method: "GET",
  });
}

export function apiAdminChildUsers() {
  return request<AdminChildUsersData>("/api/admin/users/children", {
    method: "GET",
  });
}

export function apiAdminLessons() {
  return request<{ lessons: AdminLesson[] }>("/api/admin/lessons", {
    method: "GET",
  });
}

export function apiCreateAdminLesson(input: {
  title: string;
  content: string;
  resourceType?: "text" | "pdf" | "video";
  resourceUrl?: string;
  fileName?: string;
  fileData?: string;
  isPublished?: boolean;
}) {
  return request<{ lesson: AdminLesson }>("/api/admin/lessons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiAdminQuizzes() {
  return request<{ quizzes: AdminQuiz[] }>("/api/admin/quizzes", {
    method: "GET",
  });
}

export function apiCreateAdminQuiz(input: { title: string; isPublished?: boolean }) {
  return request<{ quiz: AdminQuiz }>("/api/admin/quizzes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentAllTransactions(childId?: string) {
  const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
  return request<{ transactions: ParentTransactionSummary[] }>(`/api/parent/transactions${query}`, {
    method: "GET",
  });
}

export function apiParentFundChild(input: { childId: string; amount: number; description?: string }) {
  return request<{ message: string }>("/api/parent/fund", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentChildSavingsGoals(childId: string) {
  return request<{ goals: ParentSavingsGoalSummary[] }>(`/api/parent/children/${encodeURIComponent(childId)}/savings-goals`, {
    method: "GET",
  });
}

export function apiCreateParentSavingsGoal(childId: string, input: { title: string; targetAmount: number; targetDate?: string }) {
  return request<{ message: string; goal: ParentSavingsGoalSummary }>(`/api/parent/children/${encodeURIComponent(childId)}/savings-goals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentPublishedLessons() {
  return request<{ lessons: AdminLesson[] }>("/api/parent/learning/lessons", {
    method: "GET",
  });
}

export function apiParentLearningAssignments() {
  return request<{ assignments: ParentLearningAssignment[] }>("/api/parent/learning/assignments", {
    method: "GET",
  });
}

export function apiParentAssignLearningLesson(input: {
  childId: string;
  lessonId: string;
  studyStartAt: string;
  studyEndAt: string;
}) {
  return request<{ message: string; assignmentId: string }>("/api/parent/learning/assignments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiChildLearningLessons() {
  return request<{ lessons: ChildLearningLesson[] }>("/api/child/learning/lessons", {
    method: "GET",
  });
}

export function apiUpdateChildLearningProgress(assignmentId: string, progressPercent: number) {
  return request<{
    message: string;
    assignment: {
      assignmentId: string;
      status: string;
      progressPercent: number;
      firstViewedAt: string | null;
      lastViewedAt: string | null;
      completedAt: string | null;
    };
  }>(`/api/child/learning/lessons/${encodeURIComponent(assignmentId)}/progress`, {
    method: "PATCH",
    body: JSON.stringify({ progressPercent }),
  });
}

export function apiParentPreferences() {
  return request<{ preferences: ParentPreferences }>("/api/parent/preferences", {
    method: "GET",
  });
}

export function apiUpdateParentPreferences(input: ParentPreferences) {
  return request<{ message: string; preferences: ParentPreferences }>("/api/parent/preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function apiParentNotifications() {
  return request<{ notifications: ParentNotification[]; unreadCount: number }>("/api/parent/notifications", {
    method: "GET",
  });
}

export function apiParentMarkNotificationsRead(notificationIds: string[]) {
  return request<{ message: string }>("/api/parent/notifications/mark-read", {
    method: "PATCH",
    body: JSON.stringify({ notificationIds }),
  });
}

export function apiParentMarkAllNotificationsRead() {
  return request<{ message: string }>("/api/parent/notifications/mark-all-read", {
    method: "PATCH",
  });
}

export function apiParentReportSummary(range: "this_month" | "last_30_days" | "all_time" = "this_month") {
  return request<{ summary: ParentReportSummary }>(`/api/parent/reports/summary?range=${encodeURIComponent(range)}`, {
    method: "GET",
  });
}

export function apiParentReportExport(
  type: ParentReportExportType,
  range: "this_month" | "last_30_days" | "all_time" = "this_month"
) {
  return request<{ filename: string; csv: string; type: ParentReportExportType; range: string; rowCount: number }>(
    `/api/parent/reports/export?type=${encodeURIComponent(type)}&range=${encodeURIComponent(range)}`,
    {
      method: "GET",
    }
  );
}

export function apiParentReportPdf(
  type: ParentReportExportType,
  range: "this_month" | "last_30_days" | "all_time" = "this_month"
) {
  return request<{ filename: string; mimeType: string; pdfBase64: string; type: ParentReportExportType; range: string; count: number }>(
    `/api/parent/reports/pdf?type=${encodeURIComponent(type)}&range=${encodeURIComponent(range)}`,
    {
      method: "GET",
    }
  );
}

export function apiParentTransactionStatementPdf(input: {
  childId?: string;
  txType?: "all" | "earn" | "spend";
  txStatus?: "all" | "pending" | "approved" | "rejected";
  include: StatementIncludeField[];
}) {
  const params = new URLSearchParams();
  params.set("childId", input.childId || "all");
  params.set("txType", input.txType || "all");
  params.set("txStatus", input.txStatus || "all");
  params.set("include", input.include.join(","));
  return request<{ filename: string; mimeType: string; pdfBase64: string; count: number }>(
    `/api/parent/transactions/statement-pdf?${params.toString()}`,
    { method: "GET" }
  );
}

export function apiParentSupportTickets() {
  return request<{ tickets: ParentSupportTicket[] }>("/api/parent/support-tickets", {
    method: "GET",
  });
}

export function apiCreateParentSupportTicket(input: { issueType: string; message: string }) {
  return request<{ message: string; ticket: ParentSupportTicket }>("/api/parent/support-tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiParentAccountBalance() {
  return request<ParentAccountBalance>("/api/parent/account-balance", {
    method: "GET",
  });
}

export function apiParentDeposit(input: { amount: number }) {
  return request<{ message: string; balance: number; totalDeposited: number }>("/api/parent/deposit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiLogDashboardAction(input: {
  dashboard: "admin" | "parent" | "child";
  action: string;
  metadata?: string;
}) {
  return request<{ message: string }>("/api/actions/log", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
