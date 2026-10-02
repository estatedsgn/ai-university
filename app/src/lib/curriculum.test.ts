import { describe, expect, test } from "bun:test";
import {
  SUBJECTS,
  TOPICS,
  getAvailability,
  getNextTopics,
  getPrerequisites,
  getTopic,
} from "./curriculum";
import type { TopicProgress } from "./learning-types";

const expectedReady = [
  "math-arithmetic",
  "math-fractions",
  "math-decimals",
  "math-percent",
  "math-ratios",
  "math-powers",
  "math-linear-equations",
  "math-inequalities",
  "math-quadratics",
  "math-functions",
  "math-coordinate-geometry",
  "math-plane-geometry",
  "math-trigonometry",
  "math-sequences",
  "math-combinatorics",
  "math-probability",
  "math-statistics",
  "math-derivatives",
  "math-integrals",
  "math-vectors",
];

function progress(
  topicId: string,
  overrides: Partial<TopicProgress> = {},
): TopicProgress {
  return {
    topicId,
    attempts: 1,
    bestScore: 100,
    diagnosticPassed: true,
    transferPassed: true,
    status: "ready",
    nextReviewAt: null,
    ...overrides,
  };
}

describe("curriculum data integrity", () => {
  test("subjects and topics have unique IDs and valid references", () => {
    expect(new Set(SUBJECTS.map((subject) => subject.id)).size).toBe(SUBJECTS.length);
    expect(new Set(TOPICS.map((topic) => topic.id)).size).toBe(TOPICS.length);
    const subjects = new Set(SUBJECTS.map((subject) => subject.id));
    const ids = new Set(TOPICS.map((topic) => topic.id));
    for (const topic of TOPICS) {
      expect(subjects.has(topic.subjectId)).toBe(true);
      expect(["foundation", "school", "university", "advanced"]).toContain(topic.level);
      expect(topic.minutes).toBeGreaterThan(0);
      expect(topic.title.trim().length).toBeGreaterThan(0);
      expect(topic.outcomes.length).toBeGreaterThan(0);
      expect(topic.outcomes.every((outcome) => outcome.trim().length > 0)).toBe(true);
      expect(new Set(topic.prerequisites).size).toBe(topic.prerequisites.length);
      for (const prerequisite of topic.prerequisites) {
        expect(prerequisite).not.toBe(topic.id);
        expect(ids.has(prerequisite)).toBe(true);
      }
    }
  });

  test("prerequisite graph is acyclic, including cross-subject edges", () => {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(id: string): void {
      if (visiting.has(id)) throw new Error("Prerequisite cycle at " + id);
      if (visited.has(id)) return;
      const topic = getTopic(id);
      if (!topic) throw new Error("Missing topic " + id);
      visiting.add(id);
      topic.prerequisites.forEach(visit);
      visiting.delete(id);
      visited.add(id);
    }
    TOPICS.forEach((topic) => visit(topic.id));
    expect(visited.size).toBe(TOPICS.length);
  });

  test("branches form paths from real foundations instead of disconnected headings", () => {
    const roots = TOPICS.filter((topic) => topic.prerequisites.length === 0);
    expect(roots.map((topic) => topic.id).sort()).toEqual([
      "biology-cell",
      "math-arithmetic",
    ]);
    const reached = new Set<string>();
    const queue = roots.map((topic) => topic.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (reached.has(id)) continue;
      reached.add(id);
      queue.push(...getNextTopics(id).map((topic) => topic.id));
    }
    expect(reached.size).toBe(TOPICS.length);
    const math = TOPICS.filter((topic) => topic.subjectId === "math");
    expect(math.length).toBeGreaterThanOrEqual(55);
    expect(math.length).toBeLessThanOrEqual(75);
    expect(math.some((topic) => topic.id === "math-topology")).toBe(true);
    expect(math.some((topic) => topic.id === "math-abstract-algebra")).toBe(true);
    expect(math.some((topic) => topic.id === "math-real-analysis")).toBe(true);
    for (const subjectId of ["finance", "biology"]) {
      const count = TOPICS.filter((topic) => topic.subjectId === subjectId).length;
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(12);
    }
  });

  test("exactly the supported 20 topics have substantial lessons", () => {
    const ready = TOPICS.filter((topic) => topic.assessment === "ready");
    expect(ready.map((topic) => topic.id).sort()).toEqual([...expectedReady].sort());
    for (const topic of ready) {
      expect(topic.lesson).toBeDefined();
      expect(topic.lesson!.explanation.length).toBeGreaterThan(80);
      expect(topic.lesson!.example.length).toBeGreaterThan(30);
      expect(topic.lesson!.commonMistake.length).toBeGreaterThan(40);
      // A ready assessment must be reachable through other supported assessments.
      expect(topic.prerequisites.every((id) => expectedReady.includes(id))).toBe(true);
    }
    for (const topic of TOPICS.filter((entry) => entry.assessment === "roadmap")) {
      expect(topic.lesson).toBeUndefined();
    }
  });
});

describe("learning progression", () => {
  test("foundations can start without a previous score", () => {
    expect(getAvailability(getTopic("math-arithmetic")!, [])).toEqual({
      unlocked: true,
      missing: [],
    });
    expect(getAvailability(getTopic("biology-cell")!, [])).toEqual({
      unlocked: true,
      missing: [],
    });
  });

  test("a diagnostic score alone is not evidence of transfer", () => {
    const fractions = getTopic("math-fractions")!;
    for (const entry of [
      progress("math-arithmetic", { diagnosticPassed: false, transferPassed: false }),
      progress("math-arithmetic", { transferPassed: false }),
      progress("math-arithmetic", { diagnosticPassed: false }),
    ]) {
      const availability = getAvailability(fractions, [entry]);
      expect(availability.unlocked).toBe(false);
      expect(availability.missing.map((topic) => topic.id)).toEqual(["math-arithmetic"]);
    }
    expect(getAvailability(fractions, [progress("math-arithmetic")]).unlocked).toBe(true);
  });

  test("every prerequisite is required, and missing topics are actionable", () => {
    const percent = getTopic("math-percent")!;
    const availability = getAvailability(percent, [progress("math-fractions")]);
    expect(availability.unlocked).toBe(false);
    expect(availability.missing.map((topic) => topic.id)).toEqual(["math-decimals"]);
    expect(
      getAvailability(percent, [
        progress("math-fractions"),
        progress("math-decimals"),
      ]).unlocked,
    ).toBe(true);
  });

  test("a due review retains previously demonstrated prerequisite passes", () => {
    const state = progress("math-arithmetic", {
      status: "review",
      nextReviewAt: Date.now() - 1000,
    });
    expect(getAvailability(getTopic("math-fractions")!, [state]).unlocked).toBe(true);
  });

  test("cross-subject mathematical foundations are required", () => {
    const portfolio = getTopic("finance-portfolio")!;
    const availability = getAvailability(portfolio, [progress("finance-investments")]);
    expect(availability.unlocked).toBe(false);
    expect(availability.missing.map((topic) => topic.id)).toEqual([
      "math-vectors",
      "math-statistics",
    ]);
    expect(
      getAvailability(portfolio, [
        progress("finance-investments"),
        progress("math-vectors"),
        progress("math-statistics"),
      ]).unlocked,
    ).toBe(true);
    // Prerequisite availability does not create an assessment for a roadmap node.
    expect(portfolio.assessment).toBe("roadmap");
  });

  test("helper links provide immediate next choices and handle unknown IDs", () => {
    expect(getTopic("missing-topic")).toBeUndefined();
    expect(getPrerequisites("missing-topic")).toEqual([]);
    expect(getNextTopics("missing-topic")).toEqual([]);
    expect(getPrerequisites("math-integrals").map((topic) => topic.id)).toEqual([
      "math-derivatives",
    ]);
    const next = getNextTopics("math-derivatives").map((topic) => topic.id);
    expect(next).toContain("math-integrals");
    expect(next).not.toContain("math-numerical-integration");
  });
});
