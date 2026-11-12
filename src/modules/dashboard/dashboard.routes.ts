import { Router, type Request, type Response } from "express";
import { can } from "../../config/permissions.js";
import { env } from "../../config/env.js";
import { authorize, currentUser } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { z } from "zod";
import { signPreview } from "../../utils/jwt.js";
import { ok } from "../../utils/response.js";
import { ContentType } from "../entries/contentType.model.js";
import { Entry } from "../entries/entry.model.js";
import { Page } from "../pages/page.model.js";
import { Section } from "../sections/section.model.js";
import { User } from "../users/user.model.js";
import { recentActivity } from "./activity.service.js";
import { activityStats, mediaStats, submissionStats } from "./dashboard.stats.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", authorize("content:read"), async (req: Request, res: Response) => {
  const actor = currentUser(req);
  const visibleSections = can(actor.role, "settings:manage") ? {} : { restricted: { $ne: true } };

  const [pages, sections, hiddenSections, sectionDrafts, entryStats, types, media, users, submissions, activity, activityFigures, recentSections, recentEntries] =
    await Promise.all([
      Page.countDocuments(),
      Section.countDocuments(visibleSections),
      Section.countDocuments({ ...visibleSections, visible: false }),
      Section.countDocuments({ ...visibleSections, draft: { $ne: null } }),
      Entry.aggregate<{ _id: string; total: number; hidden: number; drafts: number }>([
        {
          $group: {
            _id: "$type",
            total: { $sum: 1 },
            hidden: { $sum: { $cond: ["$visible", 0, 1] } },
            drafts: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$draft", null] }, null] }, 1, 0] } },
          },
        },
      ]),
      ContentType.find().sort({ order: 1 }).select("key label").lean(),
      mediaStats(),
      can(actor.role, "users:read") ? User.countDocuments({ active: true }) : Promise.resolve(null),
      can(actor.role, "submissions:read") ? submissionStats() : Promise.resolve(null),
      can(actor.role, "activity:read") ? recentActivity(8) : Promise.resolve([]),
      can(actor.role, "activity:read") ? activityStats() : Promise.resolve(null),
      Section.find(visibleSections).sort({ updatedAt: -1 }).limit(6).select("page key label updatedAt updatedByName visible draft").lean(),
      Entry.find().sort({ updatedAt: -1 }).limit(6).select("type title updatedAt updatedByName visible draft").lean(),
    ]);

  const byType = new Map(entryStats.map((e) => [e._id, e]));
  const entriesTotal = entryStats.reduce((n, e) => n + e.total, 0);

  ok(res, {
    stats: {
      pages,
      sections,
      hiddenSections,
      entries: entriesTotal,
      hiddenEntries: entryStats.reduce((n, e) => n + e.hidden, 0),
      drafts: sectionDrafts + entryStats.reduce((n, e) => n + e.drafts, 0),
      sectionDrafts,
      media: media.reduce((n, m) => n + m.count, 0),
      mediaBytes: media.reduce((n, m) => n + m.size, 0),
      users,
    },
    contentTypes: types.map((t) => ({
      key: t.key,
      label: t.label,
      total: byType.get(t.key)?.total ?? 0,
      hidden: byType.get(t.key)?.hidden ?? 0,
      drafts: byType.get(t.key)?.drafts ?? 0,
    })),
    mediaKinds: media,
    /** Figures of the forms inbox; null when the role cannot see the submissions. */
    submissions,
    /** Figures of the team's activity over 30 days; null when the role cannot see the journal. */
    activityStats: activityFigures,
    recent: [
      ...recentSections.map((s) => ({
        kind: "section" as const,
        id: String(s._id),
        label: s.label,
        context: s.page,
        visible: s.visible,
        hasDraft: s.draft != null,
        updatedAt: s.updatedAt,
        updatedByName: s.updatedByName,
      })),
      ...recentEntries.map((e) => ({
        kind: "entry" as const,
        id: String(e._id),
        label: e.title,
        context: e.type,
        visible: e.visible,
        hasDraft: e.draft != null,
        updatedAt: e.updatedAt,
        updatedByName: e.updatedByName,
      })),
    ]
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .slice(0, 8),
    activity,
    siteUrl: env.siteUrl,
  });
});

const previewSchema = z.object({
  path: z.string().regex(/^\/(?!\/)[\w\-./#?=&%]*$/, "Chemin invalide").max(300).default("/"),
});

/** Returns a short-lived link that opens the website in preview mode (drafts visible). */
dashboardRoutes.post("/preview-link", authorize("content:read"), validateBody(previewSchema), (req: Request, res: Response) => {
  const token = signPreview(currentUser(req).id);
  const url = `${env.siteUrl}/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(req.body.path)}`;
  ok(res, { url });
});
