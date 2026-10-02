import { describe, expect, test } from "bun:test";
import { generateQuestions, gradeAnswer, parseNumericAnswer, READY_TOPIC_IDS } from "./assessment-bank.server";

describe("private mathematics bank", () => {
  test("all 20 banks produce five independent IDs in all three modes", () => {
    expect(READY_TOPIC_IDS).toHaveLength(20);
    const ids = new Set<string>();
    for (const topic of READY_TOPIC_IDS) for (const mode of ["diagnostic", "practice", "transfer"] as const) {
      for (let repetition = 0; repetition < 12; repetition++) {
        const questions = generateQuestions(topic, mode);
        expect(questions).toHaveLength(5);
        for (const q of questions) {
          expect(ids.has(q.id)).toBe(false); ids.add(q.id);
          expect(q.prompt.trim()).not.toBe("");
          expect(q.transfer).toBe(mode === "transfer");
          if (q.kind === "choice") {
            expect(new Set(q.options).size).toBe(q.options?.length);
            expect(q.options).toContain(String(q.answer));
          } else expect(parseNumericAnswer(q.answer)).not.toBeNull();
        }
      }
    }
    expect(() => generateQuestions("math-unwritten", "diagnostic")).toThrow();
  });

  test("arithmetic answer keys match an independently computed prompt oracle", () => {
    for (let repetition = 0; repetition < 60; repetition++) {
      for (const q of generateQuestions("math-arithmetic", "diagnostic")) {
        const v = q.prompt.match(/\d+/g)!.map(Number);
        const expected = q.prompt.includes("(") ? (v[0] + v[1]) * v[2] :
          q.prompt.includes("×") ? v[0] + v[1] * v[2] :
          q.prompt.includes("÷") ? v[0] / v[1] :
          q.prompt.includes("−") ? v[0] - v[1] : v[0] + v[1];
        expect(parseNumericAnswer(q.answer)).toBeCloseTo(expected, 10);
      }
    }
  });

  test("fraction keys are independently derived from both numerator/denominator pairs", () => {
    for (let repetition = 0; repetition < 60; repetition++) {
      for (const q of generateQuestions("math-fractions", "diagnostic")) {
        const pairs = [...q.prompt.matchAll(/(\d+)\/(\d+)/g)].map(m => Number(m[1]) / Number(m[2]));
        const expected = pairs.length === 1 ? pairs[0] : q.prompt.includes("×") ? pairs[0] * pairs[1] :
          q.prompt.includes("÷") ? pairs[0] / pairs[1] : pairs[0] + pairs[1];
        expect(parseNumericAnswer(q.answer)).toBeCloseTo(expected, 10);
        expect(gradeAnswer(q, String(expected))).toBe(true);
      }
    }
  });

  test("linear equation keys satisfy the generated equation with independently extracted coefficients", () => {
    for (let repetition = 0; repetition < 60; repetition++) {
      for (const q of generateQuestions("math-linear-equations", "diagnostic")) {
        const v = q.prompt.match(/\d+/g)!.map(Number), result = parseNumericAnswer(q.answer)!;
        if (q.prompt.includes("(x")) expect(v[0] * (result - v[1])).toBeCloseTo(v[2], 10);
        else if (q.prompt.includes("x/")) expect(result / v[0] + v[1]).toBeCloseTo(v[2], 10);
        else if (q.prompt.includes("−")) expect(v[0] * result - v[1]).toBeCloseTo(0, 10);
        else if (v.length === 4) expect(v[0] * result + v[1]).toBeCloseTo(v[2] * result + v[3], 10);
        else expect(v[0] * result + v[1]).toBeCloseTo(v[2], 10);
      }
    }
  });

  test("derivatives and definite integrals match independent calculus rules", () => {
    for (let repetition = 0; repetition < 50; repetition++) {
      for (const q of generateQuestions("math-derivatives", "diagnostic")) {
        const v = q.prompt.match(/\d+/g)!.map(Number);
        let expected: number;
        if (q.prompt.includes("(x+")) expected = 2 * (v[0] + v[1]);
        else if (q.prompt.includes("x³")) expected = 3 * v[0] ** 2;
        else if (q.prompt.includes("x²+") && v.length === 3) expected = 2 * v[0] * v[2] + v[1];
        else if (q.prompt.includes("x²")) expected = 2 * v[0];
        else expected = v[0];
        expect(parseNumericAnswer(q.answer)).toBeCloseTo(expected, 10);
      }
      for (const q of generateQuestions("math-integrals", "diagnostic")) {
        const v = q.prompt.match(/\d+/g)!.map(Number);
        const upper = v[0];
        const expected = q.prompt.includes("3x²") ? upper ** 3 :
          q.prompt.includes("2x") ? upper ** 2 :
          q.prompt.includes(" x dx") ? upper ** 2 / 2 :
          q.prompt.includes("∫₀") ? upper * v[1] : (v[1] - v[0]) * v[2];
        expect(parseNumericAnswer(q.answer)).toBeCloseTo(expected, 10);
      }
    }
  });

  test("contextual transfer arithmetic is mathematically equivalent to its story", () => {
    for (let repetition = 0; repetition < 60; repetition++) {
      for (const q of generateQuestions("math-arithmetic", "transfer")) {
        const v = q.prompt.match(/\d+/g)!.map(Number);
        const expected = q.prompt.includes("полок") ? v[0] / v[1] :
          q.prompt.includes("отдельных") ? v[0] + v[1] * v[2] :
          q.prompt.includes("партий") ? v[0] * (v[1] + v[2]) :
          q.prompt.includes("отправили") ? v[0] - v[1] : v[0] + v[1];
        expect(parseNumericAnswer(q.answer)).toBeCloseTo(expected, 10);
      }
    }
  });
});

describe("bounded numeric grading", () => {
  test("accepts fractions, decimal comma, signed numbers and scientific notation", () => {
    for (const [input, expected] of [["3/4", .75], ["1,5 / 0,3", 5], ["−2.5", -2.5], [".5", .5], ["1e-3", .001], ["-2/-4", .5]] as const) {
      expect(parseNumericAnswer(input)).toBeCloseTo(expected, 12);
    }
  });
  test("rejects expressions, zero denominators, nonfinite values and oversized input without evaluation", () => {
    for (const input of ["1/0", "1/2/3", "2+2", "sqrt(4)", "NaN", "Infinity", "1e999", "1;globalThis.process.exit()", "1 000", "", "1".repeat(129)]) {
      expect(parseNumericAnswer(input)).toBeNull();
    }
    expect(parseNumericAnswer(Infinity)).toBeNull();
  });
  test("uses bounded floating tolerance and exact selected option text", () => {
    const q = { id: "test", kind: "number" as const, prompt: "", answer: "1/3", explanation: "", transfer: false };
    expect(gradeAnswer(q, "0,3333333")).toBe(true);
    expect(gradeAnswer(q, "0.334")).toBe(false);
    const choice = { ...q, kind: "choice" as const, options: ["Первый", "Второй"], answer: "Второй" };
    expect(gradeAnswer(choice, "Второй")).toBe(true);
    expect(gradeAnswer(choice, "1")).toBe(false);
    expect(gradeAnswer(choice, "Первый")).toBe(false);
  });
});
