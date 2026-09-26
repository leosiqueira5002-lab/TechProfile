import { demoAnalysisProvider } from "./mock.ts";
import type { AnalysisProvider } from "./types.ts";

// Trocar esta seleção para o adaptador OpenAI ativa o provedor real sem alterar rota ou interface.
export const analysisProvider: AnalysisProvider = demoAnalysisProvider;
