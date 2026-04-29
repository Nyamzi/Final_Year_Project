export type UserRole = "parent" | "child" | "admin";

export type User = {
  userId: string;
  email: string;
  fullName: string;
  nin: string;
  phoneNumber: string;
  role: UserRole;
  password: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WalletSummary = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
};

export type SavingsGoal = {
  id: string;
  childId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  status: "active" | "completed";
  targetDate: string | null;
  createdAt: Date;
};

export type Transaction = {
  id: string;
  childId: string;
  amount: number;
  type: "earn" | "spend";
  status: "approved" | "pending" | "declined";
  description: string | null;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Chore = {
  id: string;
  childId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "assigned" | "completed";
  completedAt: string | null;
  createdAt: Date;
};

export type Allowance = {
  id: string;
  childId: string;
  title: string;
  amount: number;
  availableOn: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type ParentChild = {
  id: string;
  parentId: string;
  childId: string;
  nickname: string;
  age: number;
  createdAt: Date;
};

export type SpendingLimit = {
  id: string;
  childId: string;
  monthlyLimit: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Lesson = {
  id: string;
  title: string;
  content: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Quiz = {
  id: string;
  title: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Request types
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

// Response types
export type AuthMeResponse = {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
};

export type ChildDashboardResponse = {
  wallet: WalletSummary;
  savingsGoals: SavingsGoal[];
  recentTransactions: Transaction[];
  chores: Chore[];
  allowances: Allowance[];
};
