import { Router } from "express";
import { authorize } from "../../middleware/auth.js";
import { uploadLimiter } from "../../middleware/rateLimit.js";
import { upload } from "../../middleware/upload.js";
import { objectIdParam, validateBody, validateQuery } from "../../middleware/validate.js";
import * as controller from "./media.controller.js";
import { deleteMediaQuery, listMediaQuery, updateMediaSchema } from "./media.validators.js";

export const mediaRoutes = Router();

mediaRoutes.get("/", authorize("media:read"), validateQuery(listMediaQuery), controller.list);
mediaRoutes.get("/rules", authorize("media:read"), controller.rules);
mediaRoutes.post("/", authorize("media:write"), uploadLimiter, upload.array("files", 10), controller.upload);
mediaRoutes.get("/:id", authorize("media:read"), objectIdParam(), controller.get);
mediaRoutes.patch("/:id", authorize("media:write"), objectIdParam(), validateBody(updateMediaSchema), controller.update);
mediaRoutes.put("/:id/file", authorize("media:write"), objectIdParam(), uploadLimiter, upload.single("file"), controller.replace);
mediaRoutes.delete("/:id", authorize("media:delete"), objectIdParam(), validateQuery(deleteMediaQuery), controller.remove);
