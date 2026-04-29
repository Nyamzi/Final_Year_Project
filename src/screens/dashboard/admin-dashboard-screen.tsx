import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AdminAnalytics,
  AdminLesson,
  AdminQuiz,
  apiAdminAnalytics,
  apiAdminLessons,
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
      { label: "Users", icon: "US" },
      { label: "Children Accounts", icon: "CA" },
      { label: "Parents / Guardians", icon: "PG" },
      { label: "Schools / Partners", icon: "SP" },
    ],
  },
  {
    title: "TRANSACTIONS & APPROVALS",
    items: [
      { label: "Transactions", icon: "TX" },
      { label: "Approvals", icon: "AP" },
      { label: "Disputes", icon: "DP" },
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
    title: "REPORTS & ANALYTICS",
    items: [
      { label: "Reports", icon: "RP" },
      { label: "Analytics", icon: "AN" },
    ],
  },
  {
    title: "SUPPORT & SETTINGS",
    items: [
      { label: "Support Tickets", icon: "ST" },
      { label: "System Settings", icon: "SS" },
    ],
  },
];

const activityPoints = [420, 520, 740, 610, 520, 640, 570, 690, 770, 590, 520, 640];
const approvalPoints = [58, 64, 71, 68, 76, 79, 83, 86, 89];

const categoryBreakdown = [
  { label: "Shopping", amount: "UGX 980,000,000", percent: "40%", color: "#5b2ff4" },
  { label: "Education", amount: "UGX 560,000,000", percent: "23%", color: "#2979ff" },
  { label: "Food & Drinks", amount: "UGX 470,000,000", percent: "19%", color: "#24aa5a" },
  { label: "Entertainment", amount: "UGX 250,000,000", percent: "10%", color: "#ffab14" },
  { label: "Others", amount: "UGX 190,000,000", percent: "8%", color: "#a4a9bc" },
];

const adminNavTargets: Partial<Record<string, Tab>> = {
  Overview: "home",
  Reports: "lessons",
  Analytics: "quizzes",
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export function AdminDashboardScreen({ email, onLogout }: AdminDashboardScreenProps) {
  const [tab, setTab] = useState<Tab>("home");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const safeError = error && /unauthorized/i.test(error) ? "Please log in to continue." : error;
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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
        value: "UGX 2,450,000,000",
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
  }, [analytics]);

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const [analyticsData, lessonsData, quizzesData] = await Promise.all([
        apiAdminAnalytics(),
        apiAdminLessons(),
        apiAdminQuizzes(),
      ]);
      setAnalytics(analyticsData);
      setLessons(lessonsData.lessons);
      setQuizzes(quizzesData.quizzes);
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
      await apiCreateAdminLesson({ title: lessonTitle, content: lessonContent, isPublished: false });
      setStatus("Lesson created");
      setLessonTitle("");
      setLessonContent("");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lesson.");
    } finally {
      setSubmitting(false);
    }
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
                const targetTab = adminNavTargets[item.label];
                const isActive = targetTab ? targetTab === tab : "active" in item && item.active && tab === "home";
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      if (targetTab) setTab(targetTab);
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
        <Pressable style={styles.platformBtn} onPress={() => handleAdminAction("View Platform", "home")}>
          <Text style={styles.platformBtnText}>View Platform</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.contentCard} contentContainerStyle={styles.contentInner}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Admin Overview</Text>
            <Text style={styles.subtitle}>Monitor platform activity, users, and system performance.</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={styles.controlBtn} onPress={() => handleAdminAction("Select Date Range", "home")}>
              <Text style={styles.controlBtnIcon}>CAL</Text>
              <Text style={styles.controlBtnText}>May 1 - May 15, 2025</Text>
            </Pressable>
            <Pressable style={styles.controlBtn} onPress={() => handleAdminAction("Export Report", "lessons")}>
              <Text style={styles.controlBtnIcon}>DL</Text>
              <Text style={styles.controlBtnText}>Export Report</Text>
            </Pressable>
            <Pressable style={styles.bellBtn} onPress={() => handleAdminAction("Open Notifications", "home")}>
              <View style={styles.bellDot} />
              <Text style={styles.bellText}>NT</Text>
            </Pressable>
            <View style={styles.userMenuWrap}>
              <Pressable style={styles.userPill} onPress={() => setShowAccountMenu((prev) => !prev)}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{email.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>Admin User</Text>
                  <Text style={styles.userRole}>Super Admin</Text>
                </View>
                <Text style={styles.userCaret}>{showAccountMenu ? "▲" : "▼"}</Text>
              </Pressable>
              {showAccountMenu ? (
                <View style={styles.accountDropdown}>
                  <Pressable
                    style={styles.accountDropdownItem}
                    onPress={() => {
                      setShowAccountMenu(false);
                      onLogout();
                    }}
                  >
                    <Text style={styles.accountDropdownText}>Logout</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
        {safeError ? <Text style={styles.errorText}>{safeError}</Text> : null}
        {loading ? <Text style={styles.infoText}>Loading admin data...</Text> : null}

        {!loading && tab === "home" && analytics ? (
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

            <View style={styles.gridThreeCols}>
              <View style={[styles.softCard, styles.activityCard]}>
                <Text style={styles.cardTitle}>Platform Activity Overview</Text>
                <View style={styles.lineChart}>
                  {activityPoints.map((point, index) => (
                    <View key={`${point}-${index}`} style={styles.linePointWrap}>
                      <View style={[styles.lineBar, { height: (point / 800) * 130 + 10 }]} />
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
                      <Text style={styles.categoryDonutTotal}>2.45B</Text>
                      <Text style={styles.categoryDonutLabel}>Total</Text>
                    </View>
                  </View>
                  <View style={styles.categoryLegend}>
                    {categoryBreakdown.map((item) => (
                      <View key={item.label} style={styles.categoryRow}>
                        <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                        <Text style={styles.categoryName}>{item.label}</Text>
                        <Text style={styles.categoryAmount}>{item.amount} ({item.percent})</Text>
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
                <View style={styles.rowItemColumn}>
                  <View style={styles.alertRow}>
                    <View style={[styles.alertIcon, styles.alertIconDanger]}><Text style={styles.alertIconText}>!</Text></View>
                    <View style={styles.alertCopy}>
                      <Text style={styles.rowMain}>High value transaction detected</Text>
                      <Text style={styles.rowMeta}>UGX 5,000,000 by Daniel K.</Text>
                    </View>
                    <Text style={styles.alertTime}>5 min ago</Text>
                  </View>
                </View>
                <View style={styles.rowItemColumn}>
                  <View style={styles.alertRow}>
                    <View style={[styles.alertIcon, styles.alertIconWarning]}><Text style={styles.alertIconText}>!</Text></View>
                    <View style={styles.alertCopy}>
                      <Text style={styles.rowMain}>Multiple failed login attempts</Text>
                      <Text style={styles.rowMeta}>Parent account: john.doe@email.com</Text>
                    </View>
                    <Text style={styles.alertTime}>15 min ago</Text>
                  </View>
                </View>
                <View style={styles.rowItemColumn}>
                  <View style={styles.alertRow}>
                    <View style={[styles.alertIcon, styles.alertIconDanger]}><Text style={styles.alertIconText}>?</Text></View>
                    <View style={styles.alertCopy}>
                      <Text style={styles.rowMain}>Suspicious withdrawal request</Text>
                      <Text style={styles.rowMeta}>UGX 2,000,000 by Amina</Text>
                    </View>
                    <Text style={styles.alertTime}>30 min ago</Text>
                  </View>
                </View>
                <View style={styles.rowItemColumn}>
                  <View style={styles.alertRow}>
                    <View style={[styles.alertIcon, styles.alertIconInfo]}><Text style={styles.alertIconText}>i</Text></View>
                    <View style={styles.alertCopy}>
                      <Text style={styles.rowMain}>OTP failures detected</Text>
                      <Text style={styles.rowMeta}>5 failed attempts in last 10 minutes</Text>
                    </View>
                    <Text style={styles.alertTime}>45 min ago</Text>
                  </View>
                </View>
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
                  {approvalPoints.map((point, index) => (
                    <View key={`${point}-${index}`} style={[styles.approvalDot, { left: 14 + index * 16, bottom: point / 2 }]} />
                  ))}
                </View>
                <Text style={styles.bigStat}>89% Approved</Text>
              </View>
              <View style={styles.softCard}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>New Users</Text>
                  <Text style={styles.cardFilter}>This Month</Text>
                </View>
                <Text style={styles.bigValue}>1,245</Text>
                <Text style={styles.rowMeta}>New users joined</Text>
                <Text style={styles.goodDelta}>+16.4% from last month</Text>
              </View>
              <View style={styles.softCard}>
                <Text style={styles.cardTitle}>Gender Distribution (Children)</Text>
                <View style={styles.donutMock}>
                  <Text style={styles.donutCenter}>52%</Text>
                </View>
                <Text style={styles.rowMeta}>Male 4,342 | Female 3,864 | Other 136</Text>
              </View>
              <View style={styles.softCard}>
                <Text style={styles.cardTitle}>Quick Actions</Text>
                <View style={styles.actionGrid}>
                  <Pressable style={styles.actionBtn} onPress={() => handleAdminAction("Add Admin", "home")}><Text style={styles.actionBtnText}>Add Admin</Text></Pressable>
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
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>TXN-89237</Text>
                  <Text style={styles.tableCell}>Amina K.</Text>
                  <Text style={styles.tableCell}>Payment</Text>
                  <Text style={styles.tableCell}>Shopping</Text>
                  <Text style={styles.tableCell}>UGX 45,000</Text>
                  <Text style={styles.tableCellSuccess}>Completed</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>TXN-89230</Text>
                  <Text style={styles.tableCell}>Daniel K.</Text>
                  <Text style={styles.tableCell}>Withdrawal</Text>
                  <Text style={styles.tableCell}>Education</Text>
                  <Text style={styles.tableCell}>UGX 200,000</Text>
                  <Text style={styles.tableCellPending}>Pending</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>TXN-89229</Text>
                  <Text style={styles.tableCell}>Sarah M.</Text>
                  <Text style={styles.tableCell}>Allowance</Text>
                  <Text style={styles.tableCell}>Allowance</Text>
                  <Text style={styles.tableCell}>UGX 25,000</Text>
                  <Text style={styles.tableCellSuccess}>Completed</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>TXN-89228</Text>
                  <Text style={styles.tableCell}>Michael T.</Text>
                  <Text style={styles.tableCell}>Payment</Text>
                  <Text style={styles.tableCell}>Entertainment</Text>
                  <Text style={styles.tableCell}>UGX 15,000</Text>
                  <Text style={styles.tableCellSuccess}>Completed</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>TXN-89227</Text>
                  <Text style={styles.tableCell}>Aisha N.</Text>
                  <Text style={styles.tableCell}>Withdrawal</Text>
                  <Text style={styles.tableCell}>Shopping</Text>
                  <Text style={styles.tableCell}>UGX 50,000</Text>
                  <Text style={styles.tableCellDanger}>Rejected</Text>
                </View>
              </View>
              <View style={styles.colStack}>
                <View style={styles.softCard}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>Top Saving Goals</Text>
                    <Text style={styles.cardLink}>View All</Text>
                  </View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>1 New Bicycle</Text><Text style={styles.rowMeta}>UGX 48,700,000</Text></View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>2 Laptop</Text><Text style={styles.rowMeta}>UGX 78,600,000</Text></View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>3 School Fees</Text><Text style={styles.rowMeta}>UGX 32,400,000</Text></View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>4 Tablet</Text><Text style={styles.rowMeta}>UGX 21,800,000</Text></View>
                </View>
                <View style={styles.softCard}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>Support Tickets</Text>
                    <Text style={styles.cardLink}>View All</Text>
                  </View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>#TKT-1029 Balance discrepancy</Text><Text style={styles.tableCellDanger}>Open</Text></View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>#TKT-1028 Failed withdrawal</Text><Text style={styles.tableCellPending}>In Progress</Text></View>
                  <View style={styles.simpleListRow}><Text style={styles.rowMain}>#TKT-1027 Login issue</Text><Text style={styles.tableCellSuccess}>Resolved</Text></View>
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
        ) : null}

        {!loading && tab === "lessons" ? (
          <View style={styles.sectionWrap}>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Lessons</Text>
              {lessons.map((lesson) => (
                <View key={lesson.id} style={styles.rowItemColumn}>
                  <Text style={styles.rowMain}>{lesson.title}</Text>
                  <Text style={styles.rowMeta}>{lesson.isPublished ? "Published" : "Draft"}</Text>
                </View>
              ))}
              {lessons.length === 0 ? <Text style={styles.infoText}>No lessons yet.</Text> : null}
            </View>
            <View style={styles.softCard}>
              <Text style={styles.cardTitle}>Create Lesson</Text>
              <AppInput label="Title" value={lessonTitle} onChangeText={setLessonTitle} />
              <AppInput label="Content" value={lessonContent} onChangeText={setLessonContent} multiline numberOfLines={4} />
              <AppButton title="Create Lesson" loading={submitting} onPress={handleCreateLesson} />
              <AppButton title="Back to Overview" variant="ghost" onPress={() => setTab("home")} />
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
              <AppButton title="Back to Overview" variant="ghost" onPress={() => setTab("home")} />
            </View>
          </View>
        ) : null}

      </ScrollView>
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
