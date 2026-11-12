import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { authorize } from "../../middleware/auth.js";
import { submissionLimiter } from "../../middleware/rateLimit.js";
import { objectIdParam, validateBody, validateQuery } from "../../middleware/validate.js";
import { ApiError } from "../../utils/ApiError.js";
import * as controller from "./submission.controller.js";
import { cvUpload } from "./submission.files.js";
import {
  admissionSchema,
  contactSchema,
  exportSubmissionsQuery,
  jobSchema,
  listSubmissionsQuery,
  updateSubmissionSchema,
} from "./submission.validators.js";

/**
 * Forms are posted by the website's own server (never straight from a browser), which proves
 * itself with the shared secret. That is also what makes the visitor address it forwards
 * trustworthy for rate limiting.
 */
function fromWebsite(req: Request, _res: Response, next: NextFunction) {
  const given = Buffer.from(req.get("x-forms-secret") ?? "");
  const expected = Buffer.from(env.FORMS_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw ApiError.forbidden("Origine non autorisée");
  next();
}

/** Mounted under /api/public/submissions: the only public routes that write. */
export const publicSubmissionRoutes = Router();

publicSubmissionRoutes.use(fromWebsite, submissionLimiter);
publicSubmissionRoutes.post("/contact", validateBody(contactSchema), controller.createContact);
publicSubmissionRoutes.post("/admission", validateBody(admissionSchema), controller.createAdmission);
publicSubmissionRoutes.post("/job", cvUpload.single("cv"), validateBody(jobSchema), controller.createJob);

/** Mounted under /api/submissions, behind the session: the backoffice inbox. */
export const submissionRoutes = Router();

submissionRoutes.get("/", authorize("submissions:read"), validateQuery(listSubmissionsQuery), controller.list);
submissionRoutes.get("/counts", authorize("submissions:read"), controller.counts);
submissionRoutes.get("/export", authorize("submissions:read"), validateQuery(exportSubmissionsQuery), controller.exportCsv);
submissionRoutes.get("/:id", authorize("submissions:read"), objectIdParam(), controller.get);
submissionRoutes.get("/:id/cv", authorize("submissions:read"), objectIdParam(), controller.downloadCv);
submissionRoutes.patch("/:id", authorize("submissions:manage"), objectIdParam(), validateBody(updateSubmissionSchema), controller.update);
submissionRoutes.delete("/:id", authorize("submissions:manage"), objectIdParam(), controller.remove);
