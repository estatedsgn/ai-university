import { describe, expect, test } from "bun:test";
import { getTopic } from "./curriculum";
import { inferSubject, recommendTrack, validProfile, type LearnerProfile } from "./onboarding";

const BASE: LearnerProfile = {
  goal: "Хочу лучше понимать проценты и деньги",
  interest: "unsure", experience: "new", minutes: 30, format: "mixed",
};

describe("initial learner interview", () => {
  test("requires meaningful, bounded answers", () => {
    expect(validProfile(BASE)).toBe(true);
    expect(validProfile({ ...BASE, goal: "да" })).toBe(false);
    expect(validProfile({ ...BASE, goal: "x".repeat(501) })).toBe(false);
    expect(validProfile({ ...BASE, goal: "цель\nвторая строка" })).toBe(false);
    expect(validProfile({ ...BASE, minutes: 5 })).toBe(false);
  });
  test("explicit learner choice takes priority over keywords", () => {
    const chosen = recommendTrack({ ...BASE, interest: "biology" });
    expect(chosen.subject).toBe("biology");
    expect(chosen.routeIds[0]).toBe("biology-cell");
  });
  test("recognizes subject when undecided", () => {
    expect(inferSubject("Научиться работать с генетикой")).toBe("biology");
    expect(inferSubject("Понять инвестиции и бюджет")).toBe("finance");
    expect(inferSubject("Хочу решать уравнения")).toBe("math");
  });
  test("starts at a real authored assessment, not a roadmap lesson", () => {
    for (const subject of ["math", "finance", "biology"] as const) {
      const path = recommendTrack({ ...BASE, interest: subject });
      expect(getTopic(path.topicId)?.assessment).toBe("ready");
      expect(path.routeIds.every((id) => !!getTopic(id))).toBe(true);
    }
  });
  test("self-reported confidence does not imply mastery", () => {
    const confident = recommendTrack({ ...BASE, goal: "Уравнения", interest: "math", experience: "confident" });
    expect(confident.topicId).toBe("math-linear-equations");
    expect(confident.reason).toContain("не результат тестирования");
  });
});
