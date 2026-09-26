export const PROFESSIONAL_AREAS = [
  "Front-end", "Back-end", "Full Stack", "DevOps", "Data", "Cybersecurity",
  "QA", "Support / Infrastructure", "UX/UI", "Product", "Outra",
] as const;

export type ProfessionalArea = typeof PROFESSIONAL_AREAS[number];
