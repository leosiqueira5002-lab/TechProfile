export type ResumeExportPresentation = {
  buttonLabel: "Exportar como PDF" | "Disponível no Pro";
  buttonDisabled: boolean;
  showUpgradeCta: boolean;
};

export function getResumeExportPresentation(
  isPro: boolean,
  hasContent: boolean,
): ResumeExportPresentation {
  return {
    buttonLabel: isPro ? "Exportar como PDF" : "Disponível no Pro",
    buttonDisabled: isPro && !hasContent,
    showUpgradeCta: !isPro,
  };
}

export function runResumeExport({
  isPro,
  hasContent,
  print,
  onUpgrade,
}: {
  isPro: boolean;
  hasContent: boolean;
  print: () => void;
  onUpgrade: () => void;
}): "printed" | "upgrade" | "empty" {
  if (!isPro) {
    onUpgrade();
    return "upgrade";
  }
  if (!hasContent) return "empty";

  print();
  return "printed";
}
