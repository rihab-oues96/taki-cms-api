import { createHash, randomInt } from "node:crypto";
import type { AuthUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { escapeRegex, slugify } from "../../utils/text.js";
import { checkCv, cvPath, removeCv, storeCv } from "./submission.files.js";
import {
  AdmissionSubmission,
  ContactSubmission,
  JobSubmission,
  Submission,
  SUBMISSION_STATUSES,
  SUBMISSION_TYPES,
  type SubmissionDoc,
  type SubmissionStatus,
  type SubmissionType,
} from "./submission.model.js";
import type { AdmissionInput, ContactInput, JobInput, SubmissionFilters } from "./submission.validators.js";

export const TYPE_LABELS: Record<SubmissionType, string> = {
  contact: "Contact",
  admission: "Pré-inscription",
  job: "Candidature",
};

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "En attente",
  reviewed: "Consultée",
  handled: "Traitée",
};

/* ------------------------------------------------------------------ */
/* Receiving a form                                                    */
/* ------------------------------------------------------------------ */

const REFERENCE_PREFIX: Record<SubmissionType, string> = { contact: "CT", admission: "PI", job: "CA" };
// No 0/O, 1/I/L: the reference may be read over the phone.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newReference(type: SubmissionType): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `${REFERENCE_PREFIX[type]}-${code}`;
}

/** The same form sent again within this delay (double click, retry, page reload) is not stored twice. */
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;

function fingerprintOf(type: SubmissionType, input: object, fileHash = ""): string {
  const fields = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, String(v).toLowerCase()]);
  return createHash("sha256").update(JSON.stringify([type, fields, fileHash])).digest("hex");
}

async function findDuplicate(fingerprint: string): Promise<string | null> {
  const existing = await Submission.findOne({ fingerprint, createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } })
    .select("reference")
    .lean();
  return existing?.reference ?? null;
}

const isDuplicateKey = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;

/** Saves under a fresh reference; on the (very unlikely) collision, tries another one. */
async function saveWithReference(type: SubmissionType, save: (reference: string) => Promise<unknown>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const reference = newReference(type);
    try {
      await save(reference);
      return reference;
    } catch (err) {
      if (!isDuplicateKey(err) || attempt >= 4) throw err;
    }
  }
}

export async function createContact(input: ContactInput): Promise<{ reference: string }> {
  const fingerprint = fingerprintOf("contact", input);
  const duplicate = await findDuplicate(fingerprint);
  if (duplicate) return { reference: duplicate };

  const reference = await saveWithReference("contact", (ref) =>
    ContactSubmission.create({
      reference: ref,
      fingerprint,
      name: input.name,
      email: input.email,
      phone: input.phone,
      subject: input.topic,
      data: { grade: input.grade, topic: input.topic, message: input.message },
    }),
  );
  return { reference };
}

export async function createAdmission(input: AdmissionInput): Promise<{ reference: string }> {
  const fingerprint = fingerprintOf("admission", input);
  const duplicate = await findDuplicate(fingerprint);
  if (duplicate) return { reference: duplicate };

  const student = `${input.studentFirstName} ${input.studentLastName}`;
  const reference = await saveWithReference("admission", (ref) =>
    AdmissionSubmission.create({
      reference: ref,
      fingerprint,
      name: `${input.parentFirstName} ${input.parentLastName}`,
      email: input.parentEmail,
      phone: input.parentPhone,
      subject: `${student} · ${input.level} · ${input.grade}`.slice(0, 300),
      data: {
        parent: { firstName: input.parentFirstName, lastName: input.parentLastName, address: input.parentAddress },
        student: {
          firstName: input.studentFirstName,
          lastName: input.studentLastName,
          gender: input.gender,
          nationality: input.nationality,
          birthdate: input.birthdate,
          birthplace: input.birthplace,
          level: input.level,
          grade: input.grade,
          phone: input.studentPhone,
        },
        previousSchool: input.previousSchool,
      },
    }),
  );
  return { reference };
}

export async function createJob(input: JobInput, file: Express.Multer.File | undefined): Promise<{ reference: string }> {
  const rule = checkCv(file);
  const upload = file as Express.Multer.File;
  const fingerprint = fingerprintOf("job", input, createHash("sha256").update(upload.buffer).digest("hex"));
  const duplicate = await findDuplicate(fingerprint);
  if (duplicate) return { reference: duplicate };

  const cv = await storeCv(upload, rule);
  try {
    const reference = await saveWithReference("job", (ref) =>
      JobSubmission.create({
        reference: ref,
        fingerprint,
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.role,
        data: { role: input.role, link: input.link, message: input.message },
        cv,
      }),
    );
    return { reference };
  } catch (err) {
    // Never leave a CV on disk without the application it belongs to.
    await removeCv(cv);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Backoffice                                                          */
/* ------------------------------------------------------------------ */

function toListItem(s: SubmissionDoc) {
  return {
    id: String(s._id),
    type: s.type,
    reference: s.reference,
    status: s.status,
    name: s.name,
    email: s.email,
    phone: s.phone,
    subject: s.subject,
    hasCv: s.type === "job",
    hasNote: s.note !== "",
    createdAt: s.createdAt,
  };
}

function toDetail(s: SubmissionDoc) {
  return {
    ...toListItem(s),
    note: s.note,
    statusUpdatedAt: s.statusUpdatedAt,
    updatedByName: s.updatedByName,
    data: s.data,
    cv: s.type === "job" ? { originalName: s.cv.originalName, mimeType: s.cv.mimeType, size: s.cv.size } : null,
  };
}

function buildFilter(q: SubmissionFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (q.type) filter.type = q.type;
  if (q.status) filter.status = q.status;
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range.$gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) range.$lte = new Date(`${q.to}T23:59:59.999Z`);
    filter.createdAt = range;
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { subject: rx }, { reference: rx }];
  }
  return filter;
}

function sortOf(q: SubmissionFilters): Record<string, 1 | -1> {
  const direction = q.order === "asc" ? 1 : -1;
  return q.sort === "name" ? { name: direction, createdAt: -1 } : { createdAt: direction, _id: direction };
}

export type SubmissionCounts = Record<SubmissionType, Record<SubmissionStatus, number>>;

/** How many submissions of each form are in each status (tabs and badges of the inbox). */
export async function countSubmissions(): Promise<SubmissionCounts> {
  const rows = await Submission.aggregate<{ _id: { type: SubmissionType; status: SubmissionStatus }; total: number }>([
    { $group: { _id: { type: "$type", status: "$status" }, total: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(
    SUBMISSION_TYPES.map((t) => [t, Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0]))]),
  ) as SubmissionCounts;
  for (const row of rows) {
    const byStatus = counts[row._id.type];
    if (byStatus && row._id.status in byStatus) byStatus[row._id.status] = row.total;
  }
  return counts;
}

export async function listSubmissions(q: SubmissionFilters & { page: number; limit: number }) {
  const filter = buildFilter(q);
  const [items, total, counts] = await Promise.all([
    Submission.find(filter)
      .sort(sortOf(q))
      .collation({ locale: "fr", strength: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Submission.countDocuments(filter),
    countSubmissions(),
  ]);
  return { items: (items as unknown as SubmissionDoc[]).map(toListItem), total, counts };
}

async function findDoc(id: string): Promise<SubmissionDoc> {
  const doc = await Submission.findById(id).lean();
  if (!doc) throw ApiError.notFound("Demande introuvable");
  return doc as unknown as SubmissionDoc;
}

export async function getSubmission(id: string) {
  return toDetail(await findDoc(id));
}

export async function updateSubmission(actor: AuthUser, id: string, input: { status?: SubmissionStatus; note?: string }) {
  const current = await findDoc(id);
  const set: Record<string, unknown> = { updatedBy: actor.id, updatedByName: actor.name };
  if (input.note !== undefined) set.note = input.note;
  if (input.status !== undefined && input.status !== current.status) {
    set.status = input.status;
    set.statusUpdatedAt = new Date();
  }
  const updated = await Submission.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean();
  if (!updated) throw ApiError.notFound("Demande introuvable");
  return { submission: toDetail(updated as unknown as SubmissionDoc), statusChanged: "status" in set };
}

export async function deleteSubmission(id: string) {
  const doc = await findDoc(id);
  await Submission.deleteOne({ _id: doc._id });
  if (doc.type === "job") await removeCv(doc.cv);
  return toListItem(doc);
}

/** Where the CV of a job application is on disk, and the name to give the downloaded file. */
export async function getCv(id: string) {
  const doc = await findDoc(id);
  if (doc.type !== "job") throw ApiError.notFound("Cette demande n'a pas de CV");
  const ext = doc.cv.filename.split(".").pop() ?? "pdf";
  return {
    path: cvPath(doc.cv),
    filename: doc.cv.filename,
    mimeType: doc.cv.mimeType,
    // Built here rather than taken from the visitor's file name.
    downloadName: `CV-${slugify(doc.name).slice(0, 60) || "candidat"}-${doc.reference}.${ext}`,
    label: doc.name,
  };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

const EXPORT_LIMIT = 10_000;
const exportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tunis" });

type Column = [header: string, value: (s: SubmissionDoc) => string];

const COMMON_COLUMNS: Column[] = [
  ["Référence", (s) => s.reference],
  ["Type", (s) => TYPE_LABELS[s.type]],
  ["Statut", (s) => STATUS_LABELS[s.status]],
  ["Reçue le", (s) => exportDate.format(s.createdAt)],
  ["Nom", (s) => s.name],
  ["E-mail", (s) => s.email],
  ["Téléphone", (s) => s.phone],
];

const only = <T extends SubmissionType>(type: T, value: (s: Extract<SubmissionDoc, { type: T }>) => string) => {
  return (s: SubmissionDoc) => (s.type === type ? value(s as Extract<SubmissionDoc, { type: T }>) : "");
};

const TYPE_COLUMNS: Record<SubmissionType, Column[]> = {
  contact: [
    ["Sujet", only("contact", (s) => s.data.topic)],
    ["Classe actuelle de l'enfant", only("contact", (s) => s.data.grade)],
    ["Message", only("contact", (s) => s.data.message)],
  ],
  admission: [
    ["Adresse du parent", only("admission", (s) => s.data.parent.address)],
    ["Prénom de l'élève", only("admission", (s) => s.data.student.firstName)],
    ["Nom de l'élève", only("admission", (s) => s.data.student.lastName)],
    ["Genre", only("admission", (s) => s.data.student.gender)],
    ["Nationalité", only("admission", (s) => s.data.student.nationality)],
    ["Date de naissance", only("admission", (s) => s.data.student.birthdate.split("-").reverse().join("/"))],
    ["Lieu de naissance", only("admission", (s) => s.data.student.birthplace)],
    ["Niveau", only("admission", (s) => s.data.student.level)],
    ["Classe", only("admission", (s) => s.data.student.grade)],
    ["Téléphone de l'élève", only("admission", (s) => s.data.student.phone)],
    ["École précédente", only("admission", (s) => s.data.previousSchool)],
  ],
  job: [
    ["Poste souhaité", only("job", (s) => s.data.role)],
    ["Profil en ligne", only("job", (s) => s.data.link)],
    ["Message du candidat", only("job", (s) => s.data.message)],
    ["Fichier du CV", only("job", (s) => s.cv.originalName)],
  ],
};

/**
 * One CSV cell. Values come from strangers: a leading =, +, - or @ would be run as a
 * formula by a spreadsheet, so those cells are prefixed with an apostrophe. An
 * international phone number (+216 …) is the one harmless exception.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^\+\d[\d ]*$/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of every submission matching the filters, readable by Excel in French (semicolons, UTF-8 with BOM). */
export async function exportSubmissions(q: SubmissionFilters) {
  const docs = (await Submission.find(buildFilter(q))
    .sort(sortOf(q))
    .collation({ locale: "fr", strength: 1 })
    .limit(EXPORT_LIMIT)
    .lean()) as unknown as SubmissionDoc[];

  const types = q.type ? [q.type] : SUBMISSION_TYPES;
  const columns: Column[] = [...COMMON_COLUMNS, ...types.flatMap((t) => TYPE_COLUMNS[t]), ["Note interne", (s) => s.note]];
  const lines = [columns.map(([header]) => csvCell(header)), ...docs.map((s) => columns.map(([, value]) => csvCell(value(s))))];
  const today = new Date().toISOString().slice(0, 10);

  return {
    filename: `demandes-${q.type ? slugify(TYPE_LABELS[q.type]) : "toutes"}-${today}.csv`,
    content: `﻿${lines.map((cells) => cells.join(";")).join("\r\n")}\r\n`,
    total: docs.length,
  };
}
