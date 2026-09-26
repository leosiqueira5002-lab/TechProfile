import { analyzeResume } from "../provider.ts";
import type { AnalysisProvider } from "./types.ts";

export const openAIAnalysisProvider: AnalysisProvider = {
  mode: "openai",
  analyze: analyzeResume,
};
