import { Router } from "express";
import { authorize } from "../../middleware/auth.js";
import { objectIdParam, validateBody, validateQuery } from "../../middleware/validate.js";
import * as controller from "./entry.controller.js";
import {
  createContentTypeSchema,
  createEntrySchema,
  listEntriesQuery,
  publishEntrySchema,
  reorderEntriesSchema,
  saveEntryDraftSchema,
  updateContentTypeSchema,
  updateEntrySchema,
} from "./entry.validators.js";

export const contentTypeRoutes = Router();
contentTypeRoutes.get("/", authorize("content:read"), controller.listTypes);
contentTypeRoutes.post("/", authorize("content:structure"), validateBody(createContentTypeSchema), controller.createType);
contentTypeRoutes.get("/:key", authorize("content:read"), controller.getType);
contentTypeRoutes.patch("/:key", authorize("content:structure"), validateBody(updateContentTypeSchema), controller.updateType);

export const entryRoutes = Router();
entryRoutes.get("/", authorize("content:read"), validateQuery(listEntriesQuery), controller.list);
entryRoutes.post("/", authorize("content:write", "content:publish"), validateBody(createEntrySchema), controller.create);
entryRoutes.post("/reorder", authorize("content:publish"), validateBody(reorderEntriesSchema), controller.reorder);
entryRoutes.get("/:id", authorize("content:read"), objectIdParam(), controller.get);
entryRoutes.patch("/:id", authorize("content:publish"), objectIdParam(), validateBody(updateEntrySchema), controller.update);
entryRoutes.put("/:id/draft", authorize("content:write"), objectIdParam(), validateBody(saveEntryDraftSchema), controller.saveDraft);
entryRoutes.delete("/:id/draft", authorize("content:write"), objectIdParam(), controller.discardDraft);
entryRoutes.post("/:id/publish", authorize("content:publish"), objectIdParam(), validateBody(publishEntrySchema), controller.publish);
entryRoutes.delete("/:id", authorize("content:delete"), objectIdParam(), controller.remove);
