export type PersonalInfo = {
  fullName: string;
  cityState: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubPortfolioUrl: string;
};

export type ExperienceEntry = {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
};

export type EducationEntry = {
  id: string;
  institution: string;
  course: string;
  startDate: string;
  completionDate: string;
  status: string;
};

export type ProjectEntry = {
  id: string;
  name: string;
  description: string;
  technologies: string;
  link: string;
};

export type SkillEntry = { id: string; name: string };
export type LanguageEntry = { id: string; name: string; proficiency: string };
export type CertificationEntry = {
  id: string;
  name: string;
  issuer: string;
  year: string;
  url: string;
};

export type ResumeDraft = {
  personalInfo: PersonalInfo;
  desiredRole: string;
  summary: string;
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: SkillEntry[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
};

export type ResumeSectionKey =
  | "personalInfo"
  | "desiredRole"
  | "summary"
  | "experiences"
  | "education"
  | "projects"
  | "skills"
  | "languages"
  | "certifications";
