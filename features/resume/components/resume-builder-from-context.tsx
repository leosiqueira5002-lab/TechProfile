"use client";

import { useEffect, useState } from "react";
import { ResumeBuilder } from "./resume-builder.tsx";
import { useResumeDraftContext } from "../resume-draft-context.tsx";

export function ResumeBuilderFromContext() {
  const { draft, setDraft, canExportPdf } = useResumeDraftContext();
  const [initialValue] = useState(() => draft ?? undefined);

  useEffect(() => {
    if (draft) setDraft(null);
  }, [draft, setDraft]);

  return <ResumeBuilder initialValue={initialValue} canExportPdf={canExportPdf} />;
}
