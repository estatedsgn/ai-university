import { describe, expect, test } from "bun:test";
import {
  AI_PROGRAM, COURSE_SOURCES, DEGREE_MODULES, MODULE_BY_ID, SOURCE_BY_ID,
  AGENT_HANDOFFS, buildLessonLoop, estimateDuration, nextAvailableModules, TOTAL_HOURS,
} from "./degree-programs";

describe("AI learning program structure", () => {
  test("all modules, sources and dependencies resolve", () => {
    expect(new Set(DEGREE_MODULES.map((course) => course.id)).size).toBe(DEGREE_MODULES.length);
    expect(new Set(COURSE_SOURCES.map((source) => source.id)).size).toBe(COURSE_SOURCES.length);
    expect(AI_PROGRAM.moduleIds).toEqual(DEGREE_MODULES.map((course) => course.id));
    for (const course of DEGREE_MODULES) {
      expect(course.expectedHours).toBeGreaterThan(0);
      expect(course.prerequisites.every((id) => MODULE_BY_ID.has(id))).toBe(true);
      expect(course.sourceIds.every((id) => SOURCE_BY_ID.has(id))).toBe(true);
      expect(course.exam.tasks.length).toBeGreaterThan(0);
      expect(course.exam.allowedAssistance).toBe("none");
      expect(course.exam.supervision).toBe("verified-proctor-required");
      expect(course.exam.rubric.length).toBeGreaterThan(0);
    }
    for (const source of COURSE_SOURCES) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(source.rights).toBe("link-only");
    }
  });
  test("prerequisite graph has no cycles", () => {
    const visiting = new Set<string>(), visited = new Set<string>();
    function traverse(id: string): void {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error("Cycle: " + id);
      visiting.add(id);
      MODULE_BY_ID.get(id)!.prerequisites.forEach(traverse);
      visiting.delete(id); visited.add(id);
    }
    DEGREE_MODULES.forEach(({ id }) => traverse(id));
    expect(visited.size).toBe(DEGREE_MODULES.length);
  });
  test("total hours and pacing respond to workload", () => {
    expect(TOTAL_HOURS).toBe(2000);
    expect(estimateDuration(20).weeks).toBe(100);
    expect(estimateDuration(40).weeks).toBe(50);
    expect(estimateDuration(5).weeks).toBe(400);
    expect(() => estimateDuration(0)).toThrow(RangeError);
  });
  test("learning loop preserves exact session minutes", () => {
    for (const course of DEGREE_MODULES) {
      for (const minutes of [15, 30, 60] as const) {
        const stages = buildLessonLoop(course, minutes);
        expect(stages.reduce((sum, stage) => sum + stage.minutes, 0)).toBe(minutes);
        expect(stages.every((stage) => stage.minutes >= 0)).toBe(true);
        expect(stages.some((stage) => stage.id === "lecture")).toBe(true);
        expect(stages.some((stage) => stage.id === "check")).toBe(true);
        expect(stages.some((stage) => stage.id === "seminar")).toBe(course.seminar);
      }
    }
  });
  test("next available modules use explicit prerequisites", () => {
    const first = nextAvailableModules([]);
    expect(first.map((course) => course.id)).toEqual(["programming", "discrete-math", "linear-algebra"]);
    expect(nextAvailableModules(["programming"]).some((course) => course.id === "software-engineering")).toBe(true);
  });
  test("agent handoffs have valid roles", () => {
    expect(AGENT_HANDOFFS.length).toBeGreaterThanOrEqual(4);
    for (const h of AGENT_HANDOFFS) expect(h.payload.length).toBeGreaterThan(10);
  });
});
