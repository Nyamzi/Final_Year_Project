import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiChildGameScores, apiSaveChildGameScore, ChildGameScore } from "../../lib/api";
import { AppButton } from "../../ui/controls";
import { theme } from "../../ui/theme";

type GameName = "Needs vs Wants Puzzle" | "Find the Change Puzzle" | "Build the Budget Puzzle";
type NeedWantCategory = "need" | "want";

const needsWantsItems: Array<{ label: string; category: NeedWantCategory; hint: string }> = [
  { label: "School lunch", category: "need", hint: "Food helps you learn and grow." },
  { label: "New toy", category: "want", hint: "Fun, but not needed today." },
  { label: "Bus fare", category: "need", hint: "Getting safely to school matters." },
  { label: "Fancy shoes", category: "want", hint: "Nice to have, but your old shoes may still work." },
  { label: "Medicine", category: "need", hint: "Health comes first." },
  { label: "Game coins", category: "want", hint: "Entertainment can wait." },
];

const changeQuestions = [
  { item: "Notebook", price: 1500, paid: 2000, options: [200, 500, 800], answer: 500 },
  { item: "Juice", price: 2500, paid: 5000, options: [1500, 2500, 3000], answer: 2500 },
  { item: "Pencil set", price: 3200, paid: 5000, options: [1200, 1800, 2200], answer: 1800 },
];

const budgetOptions = [
  { save: 5000, spend: 3000, give: 2000, label: "Save 5,000 • Spend 3,000 • Give 2,000", score: 3 },
  { save: 1000, spend: 8500, give: 500, label: "Save 1,000 • Spend 8,500 • Give 500", score: 1 },
  { save: 4000, spend: 4000, give: 2000, label: "Save 4,000 • Spend 4,000 • Give 2,000", score: 3 },
  { save: 0, spend: 10000, give: 0, label: "Spend all 10,000", score: 0 },
];

const formatMoney = (value: number) => `UGX ${value.toLocaleString()}`;

export function MoneyPuzzlesScreen() {
  const [activeGame, setActiveGame] = useState<GameName>("Needs vs Wants Puzzle");
  const [scores, setScores] = useState<ChildGameScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [needsAnswers, setNeedsAnswers] = useState<Record<string, NeedWantCategory>>({});
  const [changeAnswers, setChangeAnswers] = useState<Record<number, number>>({});
  const [budgetChoice, setBudgetChoice] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingScores(true);
    apiChildGameScores()
      .then((data) => {
        if (isMounted) setScores(data.scores);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Could not load puzzle scores.");
      })
      .finally(() => {
        if (isMounted) setLoadingScores(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const bestByGame = useMemo(() => {
    const next = new Map<string, ChildGameScore>();
    for (const score of scores) {
      const current = next.get(score.gameName);
      if (!current || score.score / score.maxScore > current.score / current.maxScore) {
        next.set(score.gameName, score);
      }
    }
    return next;
  }, [scores]);

  async function saveScore(gameName: GameName, score: number, maxScore: number) {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const result = await apiSaveChildGameScore({ gameName, score, maxScore });
      setScores((prev) => [result.score, ...prev]);
      setStatus(`${gameName} complete: ${score}/${maxScore} stars saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save puzzle score.");
    } finally {
      setSaving(false);
    }
  }

  function finishNeedsWants() {
    const score = needsWantsItems.filter((item) => needsAnswers[item.label] === item.category).length;
    void saveScore("Needs vs Wants Puzzle", score, needsWantsItems.length);
  }

  function finishChange() {
    const score = changeQuestions.filter((question, index) => changeAnswers[index] === question.answer).length;
    void saveScore("Find the Change Puzzle", score, changeQuestions.length);
  }

  function finishBudget() {
    const selected = budgetChoice === null ? null : budgetOptions[budgetChoice];
    void saveScore("Build the Budget Puzzle", selected?.score ?? 0, 3);
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>Games</Text>
          <Text style={styles.title}>Play, think, and earn stars</Text>
          <Text style={styles.copy}>Practice needs, wants, change, and budgeting with quick money games.</Text>
        </View>
      </View>

      <View style={styles.gameTabs}>
        {(["Needs vs Wants Puzzle", "Find the Change Puzzle", "Build the Budget Puzzle"] as GameName[]).map((game) => {
          const active = activeGame === game;
          const best = bestByGame.get(game);
          return (
            <Pressable key={game} style={[styles.gameTab, active && styles.gameTabActive]} onPress={() => setActiveGame(game)}>
              <Text style={[styles.gameTabText, active && styles.gameTabTextActive]}>{game.replace(" Puzzle", "")}</Text>
              <Text style={[styles.gameTabMeta, active && styles.gameTabTextActive]}>{best ? `Best ${best.score}/${best.maxScore}` : "Not played"}</Text>
            </Pressable>
          );
        })}
      </View>

      {status ? <Text style={styles.success}>{status}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeGame === "Needs vs Wants Puzzle" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Needs vs Wants</Text>
          <Text style={styles.copy}>Tap where each item belongs.</Text>
          <View style={styles.itemGrid}>
            {needsWantsItems.map((item) => {
              const answer = needsAnswers[item.label];
              return (
                <View key={item.label} style={styles.puzzleTile}>
                  <Text style={styles.itemTitle}>{item.label}</Text>
                  <Text style={styles.itemHint}>{item.hint}</Text>
                  <View style={styles.choiceRow}>
                    <Pressable style={[styles.choiceBtn, answer === "need" && styles.choiceNeed]} onPress={() => setNeedsAnswers((prev) => ({ ...prev, [item.label]: "need" }))}>
                      <Text style={styles.choiceText}>Need</Text>
                    </Pressable>
                    <Pressable style={[styles.choiceBtn, answer === "want" && styles.choiceWant]} onPress={() => setNeedsAnswers((prev) => ({ ...prev, [item.label]: "want" }))}>
                      <Text style={styles.choiceText}>Want</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
          <AppButton title={saving ? "Saving..." : "Check My Sorting"} loading={saving} onPress={finishNeedsWants} />
        </View>
      ) : null}

      {activeGame === "Find the Change Puzzle" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find the Change</Text>
          <Text style={styles.copy}>Pick the correct change after paying.</Text>
          {changeQuestions.map((question, index) => (
            <View key={question.item} style={styles.changeCard}>
              <Text style={styles.itemTitle}>{question.item}</Text>
              <Text style={styles.itemHint}>Price {formatMoney(question.price)} • Paid {formatMoney(question.paid)}</Text>
              <View style={styles.choiceRowWrap}>
                {question.options.map((option) => (
                  <Pressable key={option} style={[styles.choiceBtn, changeAnswers[index] === option && styles.choiceChange]} onPress={() => setChangeAnswers((prev) => ({ ...prev, [index]: option }))}>
                    <Text style={styles.choiceText}>{formatMoney(option)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <AppButton title={saving ? "Saving..." : "Check My Change"} loading={saving} onPress={finishChange} />
        </View>
      ) : null}

      {activeGame === "Build the Budget Puzzle" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Build the Budget</Text>
          <Text style={styles.copy}>You have {formatMoney(10000)}. Choose a smart Save, Spend, Give plan.</Text>
          {budgetOptions.map((option, index) => (
            <Pressable key={option.label} style={[styles.budgetOption, budgetChoice === index && styles.budgetOptionActive]} onPress={() => setBudgetChoice(index)}>
              <Text style={styles.itemTitle}>{option.label}</Text>
              <View style={styles.budgetBars}>
                <View style={[styles.budgetBar, styles.saveBar, { flex: option.save || 1 }]} />
                <View style={[styles.budgetBar, styles.spendBar, { flex: option.spend || 1 }]} />
                <View style={[styles.budgetBar, styles.giveBar, { flex: option.give || 1 }]} />
              </View>
            </Pressable>
          ))}
          <AppButton title={saving ? "Saving..." : "Check My Budget"} loading={saving} onPress={finishBudget} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Puzzle Stars</Text>
        {loadingScores ? <Text style={styles.copy}>Loading scores...</Text> : null}
        {!loadingScores && scores.length === 0 ? <Text style={styles.copy}>Play a puzzle to save your first score.</Text> : null}
        {scores.slice(0, 5).map((score) => (
          <View key={score.id} style={styles.scoreRow}>
            <Text style={styles.scoreName}>{score.gameName.replace(" Puzzle", "")}</Text>
            <Text style={styles.scoreValue}>{score.score}/{score.maxScore}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { gap: 14, paddingBottom: 18 },
  hero: { borderRadius: 22, backgroundColor: "#ffe8a3", borderWidth: 2, borderColor: "#ffca4d", padding: 18 },
  eyebrow: { color: "#8a4b00", fontWeight: "900", fontSize: 13, textTransform: "uppercase" },
  title: { color: "#1f2a5c", fontSize: 28, fontWeight: "900" },
  copy: { color: "#64708f", fontWeight: "600", lineHeight: 20 },
  gameTabs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gameTab: { flexGrow: 1, flexBasis: 150, borderRadius: 16, borderWidth: 2, borderColor: "#dbe3ff", backgroundColor: "#ffffff", padding: 12 },
  gameTabActive: { backgroundColor: "#6d5dfc", borderColor: "#4f46e5" },
  gameTabText: { color: "#1f2a5c", fontWeight: "900" },
  gameTabMeta: { color: "#7b84a4", fontSize: 12, marginTop: 3, fontWeight: "700" },
  gameTabTextActive: { color: "#ffffff" },
  card: { borderRadius: 20, borderWidth: 1, borderColor: "#dbe3ff", backgroundColor: "#ffffff", padding: 14, gap: 12 },
  cardTitle: { color: "#1f2a5c", fontSize: 22, fontWeight: "900" },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  puzzleTile: { flexGrow: 1, flexBasis: 180, borderRadius: 16, backgroundColor: "#f8faff", borderWidth: 1, borderColor: "#e6e9fb", padding: 12, gap: 8 },
  itemTitle: { color: "#26305f", fontSize: 16, fontWeight: "900" },
  itemHint: { color: "#697492", fontSize: 12, fontWeight: "600" },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceBtn: { borderRadius: 999, borderWidth: 1, borderColor: "#dbe3ff", backgroundColor: "#ffffff", paddingVertical: 9, paddingHorizontal: 12, alignItems: "center" },
  choiceNeed: { backgroundColor: "#bbf7d0", borderColor: "#22c55e" },
  choiceWant: { backgroundColor: "#fde68a", borderColor: "#f59e0b" },
  choiceChange: { backgroundColor: "#bfdbfe", borderColor: "#3b82f6" },
  choiceText: { color: "#1f2a5c", fontWeight: "900" },
  changeCard: { borderRadius: 16, backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#bae6fd", padding: 12, gap: 8 },
  budgetOption: { borderRadius: 16, borderWidth: 1, borderColor: "#dbe3ff", backgroundColor: "#fbfcff", padding: 12, gap: 8 },
  budgetOptionActive: { borderColor: "#7c3aed", backgroundColor: "#f3e8ff" },
  budgetBars: { height: 12, flexDirection: "row", borderRadius: 999, overflow: "hidden", backgroundColor: "#e5e7eb" },
  budgetBar: { height: 12 },
  saveBar: { backgroundColor: "#22c55e" },
  spendBar: { backgroundColor: "#38bdf8" },
  giveBar: { backgroundColor: "#f97316" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#eef1f8", paddingTop: 10, gap: 8 },
  scoreName: { color: "#26305f", fontWeight: "800", flex: 1 },
  scoreValue: { color: theme.colors.primary, fontWeight: "900" },
  success: { color: theme.colors.success, fontWeight: "800" },
  error: { color: theme.colors.danger, fontWeight: "800" },
});

