import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyResumeDraft,
  canExportResume,
  getVisibleResumeSections,
  isValidOptionalEmail,
  isValidOptionalUrl,
  removeResumeItem,
  RESUME_FIELD_LIMITS,
  updateResumeItem,
} from "../features/resume/model.ts";

test("createEmptyResumeDraft returns blank scalar fields and empty sections", () => {
  assert.deepEqual(createEmptyResumeDraft(), {
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
  });
});

test("getVisibleResumeSections omits blank and whitespace-only sections", () => {
  const draft = createEmptyResumeDraft();
  draft.summary = "  \n ";
  draft.experiences = [{
    id: "experience-1",
    company: " ",
    position: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "\t",
  }];
  draft.projects = [{
    id: "project-1",
    name: "Site pessoal",
    description: "",
    technologies: "",
    link: "",
  }];

  assert.deepEqual(getVisibleResumeSections(draft), ["projects"]);
});

test("an empty resume cannot be exported", () => {
  const draft = createEmptyResumeDraft();
  assert.equal(canExportResume(draft), false);
});

test("a resume with content can be exported", () => {
  const draft = createEmptyResumeDraft();
  draft.personalInfo.fullName = "Joana Silva";
  assert.equal(canExportResume(draft), true);
});

test("a current experience remains visible even when its end date is empty", () => {
  const draft = createEmptyResumeDraft();
  draft.experiences = [{
    id: "experience-current",
    company: "",
    position: "",
    startDate: "",
    endDate: "",
    isCurrent: true,
    description: "",
  }];

  assert.deepEqual(getVisibleResumeSections(draft), ["experiences"]);
});

test("updateResumeItem changes one item and preserves the others", () => {
  const items = [{ id: "one", name: "A" }, { id: "two", name: "B" }];

  assert.deepEqual(updateResumeItem(items, "one", { name: "Atualizado" }), [
    { id: "one", name: "Atualizado" },
    { id: "two", name: "B" },
  ]);
});

test("removeResumeItem removes only the matching item", () => {
  const items = [{ id: "one", name: "A" }, { id: "two", name: "B" }];

  assert.deepEqual(removeResumeItem(items, "one"), [{ id: "two", name: "B" }]);
});

test("optional email accepts empty input and rejects malformed addresses", () => {
  assert.equal(isValidOptionalEmail("  "), true);
  assert.equal(isValidOptionalEmail("person@example.com"), true);
  assert.equal(isValidOptionalEmail("not-an-email"), false);
});

test("optional URL accepts empty input and rejects malformed URLs", () => {
  assert.equal(isValidOptionalUrl(""), true);
  assert.equal(isValidOptionalUrl("https://example.com/profile"), true);
  assert.equal(isValidOptionalUrl("javascript:alert(1)"), false);
  assert.equal(isValidOptionalUrl("not a URL"), false);
});

test("field limits are centralized and allow ordinary resume content", () => {
  assert.equal(RESUME_FIELD_LIMITS.personalInfo.fullName, 120);
  assert.equal(RESUME_FIELD_LIMITS.personalInfo.email, 254);
  assert.equal(RESUME_FIELD_LIMITS.summary, 2000);
  assert.equal(RESUME_FIELD_LIMITS.experiences.description, 4000);
  assert.equal(RESUME_FIELD_LIMITS.certifications.year, 4);
});
