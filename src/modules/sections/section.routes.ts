import { Router } from "express";
import { authorize } from "../../middleware/auth.js";
import { objectIdParam, validateBody, validateQuery } from "../../middleware/validate.js";
import * as controller from "./section.controller.js";
import {
  createSectionSchema,
  listSectionsQuery,
  publishSchema,
  reorderSchema,
  saveContentSchema,
  updateSectionSchema,
} from "./section.validators.js";

export const sectionRoutes = Router();

sectionRoutes.get("/", authorize("content:read"), validateQuery(listSectionsQuery), controller.list);
sectionRoutes.post("/", authorize("content:structure"), validateBody(createSectionSchema), controller.create);
sectionRoutes.post("/reorder", authorize("content:publish"), validateBody(reorderSchema), controller.reorder);
sectionRoutes.get("/:id", authorize("content:read"), objectIdParam(), controller.get);
sectionRoutes.patch("/:id", authorize("content:write"), objectIdParam(), validateBody(updateSectionSchema), controller.update);
sectionRoutes.put("/:id/draft", authorize("content:write"), objectIdParam(), validateBody(saveContentSchema), controller.saveDraft);
sectionRoutes.delete("/:id/draft", authorize("content:write"), objectIdParam(), controller.discardDraft);
sectionRoutes.post("/:id/publish", authorize("content:publish"), objectIdParam(), validateBody(publishSchema), controller.publish);
sectionRoutes.delete("/:id", authorize("content:delete"), objectIdParam(), controller.remove);
