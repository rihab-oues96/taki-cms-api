import multer from "multer";
import { MAX_UPLOAD_BYTES, ruleForMime } from "../modules/media/media.rules.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Files are held in memory until their real type has been verified (see media.service);
 * nothing unchecked ever touches the disk.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (ruleForMime(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest(`Type de fichier non autorisé : ${file.originalname}`));
  },
});
