import type { ReactNode } from "react";
import { ResumeDraftProvider } from "@/features/resume/resume-draft-context";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <ResumeDraftProvider>{children}</ResumeDraftProvider>;
}
