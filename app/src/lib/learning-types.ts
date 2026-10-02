export type SubjectId = "math" | "finance" | "biology";
export type TopicLevel = "foundation" | "school" | "university" | "advanced";
export type AssessmentMode = "diagnostic" | "practice" | "transfer";
export type Topic = {
  id: string; subjectId: SubjectId; title: string; branch: string; level: TopicLevel;
  prerequisites: string[]; outcomes: string[]; minutes: number;
  assessment: "ready" | "roadmap";
  lesson?: { explanation: string; example: string; commonMistake: string };
};
export type Subject = { id: SubjectId; title: string; description: string };
export type PublicQuestion = { id: string; prompt: string; kind: "number" | "choice"; options?: string[] };
export type PrivateQuestion = PublicQuestion & { answer: string | number; explanation: string; transfer: boolean };
export type TopicProgress = {
  topicId: string; attempts: number; bestScore: number; diagnosticPassed: boolean;
  transferPassed: boolean; status: "new" | "practice" | "ready" | "review";
  nextReviewAt: number | null;
};
export type AssessmentSummary = {
  correct: number; total: number; score: number; automatic: boolean;
  reasoningRequired: boolean; reasoningProvided: boolean;
  reviewStatus: "self-check" | "needs-review" | "practice-evidence";
  completedAt: number; canAdvance: boolean;
};
export type AssessmentView = {
  id: string; topicId: string | null; topicTitle: string; mode: AssessmentMode;
  questionCount: number; answered: number; question: PublicQuestion | null;
  deadlineAt: number | null; completed: boolean; summary?: AssessmentSummary;
};
export type AssessmentStartInput = {
  topicId?: string; materialId?: string; mode: AssessmentMode; timed?: boolean;
};
export type AnswerInput = { assessmentId: string; questionId: string; answer: string; reasoning?: string };
export type AnswerResult = { correct: boolean; feedback: string; assessment: AssessmentView };
export type MaterialPublic = {
  id: string; title: string; summary: string; sourceUrl: string | null;
  track: SubjectId | "custom"; questionCount: number; createdAt: number;
  origin: "ai" | "agent"; reviewed: false; visibility: "private" | "unlisted";
};
export type AgentQuiz = {
  title: string; summary: string;
  questions: { prompt: string; options: string[]; correctIndex: number; explanation: string }[];
};
export type MaterialImportInput = {
  title?: string; text?: string; url?: string; track?: SubjectId | "custom";
  agentQuiz?: AgentQuiz; visibility?: "private" | "unlisted";
};
