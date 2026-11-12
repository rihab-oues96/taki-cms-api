import { Router, type Request, type Response } from "express";
import { can } from "../../config/permissions.js";
import { authorize, currentUser } from "../../middleware/auth.js";
import { ok } from "../../utils/response.js";
import { Section } from "../sections/section.model.js";
import { Page } from "./page.model.js";

export const pageRoutes = Router();

/** Pages with the counters the navigation needs (sections, hidden, pending drafts). */
pageRoutes.get("/", authorize("content:read"), async (req: Request, res: Response) => {
  const seeRestricted = can(currentUser(req).role, "settings:manage");
  const [pages, stats] = await Promise.all([
    Page.find().sort({ order: 1 }).lean(),
    Section.aggregate<{ _id: string; sections: number; hidden: number; drafts: number; updatedAt: Date }>([
      ...(seeRestricted ? [] : [{ $match: { restricted: { $ne: true } } }]),
      {
        $group: {
          _id: "$page",
          sections: { $sum: 1 },
          hidden: { $sum: { $cond: ["$visible", 0, 1] } },
          drafts: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$draft", null] }, null] }, 1, 0] } },
          updatedAt: { $max: "$updatedAt" },
        },
      },
    ]),
  ]);
  const byPage = new Map(stats.map((s) => [s._id, s]));
  ok(
    res,
    pages.map((p) => ({
      key: p.key,
      label: p.label,
      path: p.path,
      description: p.description,
      sections: byPage.get(p.key)?.sections ?? 0,
      hidden: byPage.get(p.key)?.hidden ?? 0,
      drafts: byPage.get(p.key)?.drafts ?? 0,
      updatedAt: byPage.get(p.key)?.updatedAt ?? null,
    })),
  );
});
