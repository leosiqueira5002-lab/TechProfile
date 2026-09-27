import type { ResumeDraft, ResumeSectionKey } from "./types.ts";

export const RESUME_FIELD_LIMITS = {
  personalInfo: {
    fullName: 120,
    cityState: 120,
    email: 254,
    phone: 40,
    linkedinUrl: 2048,
    githubPortfolioUrl: 2048,
  },
  desiredRole: 120,
  summary: 2000,
  experiences: {
    company: 180,
    position: 180,
    startDate: 20,
    endDate: 20,
    description: 4000,
  },
  education: {
    institution: 180,
    course: 180,
    startDate: 20,
    completionDate: 20,
    status: 100,
  },
  projects: {
    name: 180,
    description: 4000,
    technologies: 1000,
    link: 2048,
  },
  skills: { name: 100 },
  languages: { name: 100, proficiency: 100 },
  certifications: { name: 180, issuer: 180, year: 4, url: 2048 },
} as const;

export function createEmptyResumeDraft(): ResumeDraft {
  return {
    personalInfo: {
      fullName: "",
      cityState: "",
      email: "",
      phone: "",
      linkedinUrl: "",
      githubPortfolioUrl: "",
    },
    desiredRole: "",
    summary: "",
    experiences: [],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    certifications: [],
  };
}

export function removeResumeItem<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function updateResumeItem<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => item.id === id ? { ...item, ...patch, id: item.id } : item);
}

export function hasResumeText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidOptionalEmail(value: string): boolean {
  if (!hasResumeText(value)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidOptionalUrl(value: string): boolean {
  if (!hasResumeText(value)) return true;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getVisibleResumeSections(draft: ResumeDraft): ResumeSectionKey[] {
  const sections: ResumeSectionKey[] = [];

  if (hasVisibleText(draft.personalInfo)) sections.push("personalInfo");
  if (hasResumeText(draft.desiredRole)) sections.push("desiredRole");
  if (hasResumeText(draft.summary)) sections.push("summary");
  if (hasVisibleTextInList(draft.experiences)) sections.push("experiences");
  if (hasVisibleTextInList(draft.education)) sections.push("education");
  if (hasVisibleTextInList(draft.projects)) sections.push("projects");
  if (hasVisibleTextInList(draft.skills)) sections.push("skills");
  if (hasVisibleTextInList(draft.languages)) sections.push("languages");
  if (hasVisibleTextInList(draft.certifications)) sections.push("certifications");

  return sections;
}

export function canExportResume(draft: ResumeDraft): boolean {
  return getVisibleResumeSections(draft).length > 0;
}

function hasVisibleText(value: unknown): boolean {
  if (typeof value === "string") return hasResumeText(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(hasVisibleText);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => key !== "id" && hasVisibleText(nested));
  }
  return false;
}

function hasVisibleTextInList(items: readonly unknown[]): boolean {
  return items.some(hasVisibleText);
}
