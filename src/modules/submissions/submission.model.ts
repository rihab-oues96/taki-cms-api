import { Schema, model } from "mongoose";

export const SUBMISSION_TYPES = ["contact", "admission", "job"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const SUBMISSION_STATUSES = ["pending", "reviewed", "handled"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * What a visitor sent through one of the website's forms. The three forms share one
 * collection (one inbox to list, filter and export); each has its own model below, which
 * adds the fields specific to that form under `data`.
 */
const submissionSchema = new Schema(
  {
    /** Short code given to the visitor in the confirmation message, e.g. `PI-7K2M9Q`. */
    reference: { type: String, required: true, unique: true },
    status: { type: String, enum: SUBMISSION_STATUSES, default: "pending" },
    /** The person to answer: the parent for a pre-registration, the candidate for a job application. */
    name: { type: String, required: true, maxlength: 200 },
    email: { type: String, required: true, maxlength: 254 },
    phone: { type: String, required: true, maxlength: 40 },
    /** One line shown in the list: the topic, the pupil or the position applied for. */
    subject: { type: String, default: "", maxlength: 300 },
    /** Internal note written by the team, never shown to the visitor. */
    note: { type: String, default: "", maxlength: 2000 },
    /** Hash of the content, used to recognise the same form sent twice. */
    fingerprint: { type: String, required: true },
    statusUpdatedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true, discriminatorKey: "type" },
);

submissionSchema.index({ type: 1, status: 1, createdAt: -1 });
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ name: 1 });
submissionSchema.index({ fingerprint: 1, createdAt: -1 });

export const Submission = model("Submission", submissionSchema);

const text = (maxlength: number) => ({ type: String, default: "", maxlength });

export const ContactSubmission = Submission.discriminator(
  "contact",
  new Schema({
    data: {
      grade: text(120),
      topic: text(200),
      message: text(5000),
    },
  }),
);

export const AdmissionSubmission = Submission.discriminator(
  "admission",
  new Schema({
    data: {
      parent: {
        firstName: text(100),
        lastName: text(100),
        address: text(300),
      },
      student: {
        firstName: text(100),
        lastName: text(100),
        gender: text(60),
        nationality: text(100),
        /** ISO date, `YYYY-MM-DD`. */
        birthdate: text(10),
        birthplace: text(150),
        level: text(60),
        grade: text(120),
        phone: text(40),
      },
      previousSchool: text(120),
    },
  }),
);

export const JobSubmission = Submission.discriminator(
  "job",
  new Schema({
    data: {
      role: text(150),
      link: text(500),
      message: text(5000),
    },
    /** The CV, stored outside the public uploads folder (see submission.files.ts). */
    cv: {
      filename: { type: String, required: true },
      originalName: { type: String, required: true, maxlength: 200 },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    },
  }),
);

/* What the documents look like once read (discriminators are not reflected in Mongoose's inferred types). */

export interface ContactData {
  grade: string;
  topic: string;
  message: string;
}

export interface AdmissionData {
  parent: { firstName: string; lastName: string; address: string };
  student: {
    firstName: string;
    lastName: string;
    gender: string;
    nationality: string;
    birthdate: string;
    birthplace: string;
    level: string;
    grade: string;
    phone: string;
  };
  previousSchool: string;
}

export interface JobData {
  role: string;
  link: string;
  message: string;
}

export interface CvFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface SubmissionBase {
  _id: unknown;
  reference: string;
  status: SubmissionStatus;
  name: string;
  email: string;
  phone: string;
  subject: string;
  note: string;
  fingerprint: string;
  statusUpdatedAt: Date | null;
  updatedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SubmissionDoc = SubmissionBase &
  ({ type: "contact"; data: ContactData } | { type: "admission"; data: AdmissionData } | { type: "job"; data: JobData; cv: CvFile });
