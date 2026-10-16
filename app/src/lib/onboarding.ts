import { getTopic } from "./curriculum";
import type { SubjectId } from "./learning-types";

export type LearnerProfile = {
  goal: string;
  interest: SubjectId | "unsure";
  experience: "new" | "some" | "confident";
  minutes: 15 | 30 | 60;
  format: "explain" | "practice" | "mixed";
};

export type LearningRecommendation = {
  subject: SubjectId;
  topicId: string;
  routeIds: string[];
  reason: string;
  availability: string;
};

const ROUTES: Record<SubjectId, string[]> = {
  math: ["math-arithmetic", "math-fractions", "math-percent", "math-linear-equations", "math-functions"],
  finance: ["math-arithmetic", "math-percent", "finance-literacy", "finance-budget", "finance-interest"],
  biology: ["biology-cell", "biology-chemistry", "biology-genetics", "biology-physiology"],
};

const LABELS: Record<SubjectId, string> = {
  math: "Математика",
  finance: "Финансы",
  biology: "Биология",
};

export function validProfile(value: unknown): value is LearnerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return typeof p.goal === "string" && p.goal.trim().length >= 5 && p.goal.trim().length <= 500 &&
    !/[\x00-\x1f\x7f]/.test(p.goal) &&
    typeof p.interest === "string" && ["math", "finance", "biology", "unsure"].includes(p.interest) &&
    typeof p.experience === "string" && ["new", "some", "confident"].includes(p.experience) &&
    typeof p.minutes === "number" && [15, 30, 60].includes(p.minutes) &&
    typeof p.format === "string" && ["explain", "practice", "mixed"].includes(p.format);
}

export function inferSubject(goal: string): SubjectId {
  const text = goal.toLowerCase();
  if (/(биолог|медицин|генетик|клетк|эколог|организм|животн|растен)/i.test(text)) return "biology";
  if (/(финанс|деньг|бюджет|инвест|банков|экономик|бизнес|бухгалтер|процент по кредит)/i.test(text)) return "finance";
  return "math";
}

/** A suggestion, never a certification or a measured knowledge level. */
export function recommendTrack(profile: LearnerProfile, suggested?: SubjectId): LearningRecommendation {
  const subject = suggested ?? (profile.interest === "unsure" ? inferSubject(profile.goal) : profile.interest);
  const routeIds = ROUTES[subject];
  // Use a real, authored diagnostic even when the requested subject's course is still a roadmap.
  const firstReady = routeIds.find((id) => getTopic(id)?.assessment === "ready");
  const topicId = subject === "math"
    ? profile.experience === "new" ? "math-arithmetic" :
      profile.experience === "some" ? "math-fractions" : "math-linear-equations"
    : firstReady ?? "math-arithmetic";
  const availability = subject === "math"
    ? "Для математических тем есть задания и диагностика. Уровень уточняется только после решения задач."
    : "Полноценные уроки и проверки этого направления ещё готовятся. Пока можно проверить математические основы и посмотреть карту будущих тем.";
  return {
    subject,
    topicId,
    routeIds,
    reason: `Вы выбрали направление «${LABELS[subject]}», ${profile.minutes} минут на занятие и формат «${profile.format === "explain" ? "объяснения" : profile.format === "practice" ? "практика" : "смешанный"}». Это предварительный маршрут по вашим ответам, не результат тестирования.`,
    availability,
  };
}
