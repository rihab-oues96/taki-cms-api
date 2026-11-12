import { z } from "zod";
import { SUBMISSION_STATUSES, SUBMISSION_TYPES } from "./submission.model.js";

/* ------------------------------------------------------------------ */
/* What visitors send. Field names are the names of the form inputs,   */
/* so a validation issue points at the input to correct.               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const REQUIRED = "Ce champ est obligatoire";
const tooLong = (max: number) => `Ce champ est trop long (${max} caractères maximum)`;

/** One line of text: control characters removed, whitespace collapsed. Anything that is not a string counts as empty. */
const oneLine = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim() : "");
/** Free text: line breaks are kept, runs of blank lines are shortened. */
const multiLine = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(CONTROL_CHARS, "")
        .replace(/\r\n?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : "";

const required = (max: number) => z.preprocess(oneLine, z.string().min(1, REQUIRED).max(max, tooLong(max)));
const optional = (max: number) => z.preprocess(oneLine, z.string().max(max, tooLong(max)));
const message = z.preprocess(multiLine, z.string().max(5000, tooLong(5000)));

const email = z.preprocess(
  (v) => oneLine(v).toLowerCase(),
  z
    .string()
    .min(1, REQUIRED)
    .max(254, tooLong(254))
    .regex(/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;.]{2,}$/, "Adresse e-mail invalide"),
);

const PHONE = /^\+?[\d\s().-]{6,24}$/;
const validPhone = (v: string) => PHONE.test(v) && v.replace(/\D/g, "").length >= 6;
const phone = z.preprocess(oneLine, z.string().min(1, REQUIRED).refine(validPhone, "Numéro de téléphone invalide"));
const optionalPhone = z.preprocess(
  oneLine,
  z.string().refine((v) => v === "" || validPhone(v), "Numéro de téléphone invalide"),
);

const birthdate = z.preprocess(
  oneLine,
  z
    .string()
    .min(1, REQUIRED)
    .refine((v) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const date = new Date(`${v}T00:00:00Z`);
      // Rejects impossible days (2020-02-31) as well as dates in the future or far in the past.
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v) return false;
      const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 2 && age <= 30;
    }, "Date de naissance invalide"),
);

const link = z.preprocess(
  oneLine,
  z
    .string()
    .max(500, tooLong(500))
    .refine((v) => {
      if (v === "") return true;
      try {
        return ["http:", "https:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }, "Lien invalide : il doit commencer par https://"),
);

/** Hidden input that people never see: only robots fill it (see the controller). */
const honeypot = { website: z.preprocess(oneLine, z.string().max(500)).optional() };

export const contactSchema = z.object({
  name: required(150),
  phone,
  email,
  grade: optional(120),
  topic: required(200),
  message,
  ...honeypot,
});

export const admissionSchema = z.object({
  parentFirstName: required(100),
  parentLastName: required(100),
  parentPhone: phone,
  parentEmail: email,
  parentAddress: required(300),
  studentFirstName: required(100),
  studentLastName: required(100),
  gender: required(60),
  nationality: required(100),
  birthdate,
  birthplace: required(150),
  level: required(60),
  grade: required(120),
  studentPhone: optionalPhone,
  previousSchool: required(120),
  ...honeypot,
});

export const jobSchema = z.object({
  name: required(150),
  phone,
  email,
  role: required(150),
  link,
  message,
  ...honeypot,
});

export type ContactInput = z.infer<typeof contactSchema>;
export type AdmissionInput = z.infer<typeof admissionSchema>;
export type JobInput = z.infer<typeof jobSchema>;

/* ------------------------------------------------------------------ */
/* Backoffice                                                          */
/* ------------------------------------------------------------------ */

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

const filters = {
  type: z.enum(SUBMISSION_TYPES).optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  /** Received on or after / on or before this day. */
  from: day.optional(),
  to: day.optional(),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
};

export const listSubmissionsQuery = z.object({
  ...filters,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportSubmissionsQuery = z.object(filters);

export type SubmissionFilters = z.infer<typeof exportSubmissionsQuery>;

export const updateSubmissionSchema = z
  .object({
    status: z.enum(SUBMISSION_STATUSES, "Statut invalide"),
    note: z.preprocess(multiLine, z.string().max(2000, tooLong(2000))),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucune modification");
