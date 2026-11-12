import { Media } from "../media/media.model.js";
import { Submission, SUBMISSION_TYPES, type SubmissionDoc, type SubmissionType } from "../submissions/submission.model.js";
import { countSubmissions } from "../submissions/submission.service.js";
import { Activity } from "./activity.model.js";

/** Days are counted in the school's timezone (no daylight saving time), as in the CSV export. */
const TIMEZONE = "Africa/Tunis";
const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } };

/** The last `count` days as `YYYY-MM-DD`, oldest first, today included. */
function lastDays(count: number): string[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => dayKey.format(new Date(now - (count - 1 - i) * DAY_MS)));
}

/** Twice the longest period of the trend chart, so each period can be compared with the one before. */
const SUBMISSION_DAYS = 180;
const ACTIVITY_DAYS = 30;

/** Figures of the forms inbox: volumes, follow-up and trend. */
export async function submissionStats() {
  const days = lastDays(SUBMISSION_DAYS);
  const since = new Date(Date.now() - (SUBMISSION_DAYS + 1) * DAY_MS);

  const [counts, daily, handling, oldestPending, latest] = await Promise.all([
    countSubmissions(),
    Submission.aggregate<{ _id: { day: string; type: SubmissionType }; total: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { day: dayOf, type: "$type" }, total: { $sum: 1 } } },
    ]),
    // Time between the reception of a form and the moment it was marked as handled.
    Submission.aggregate<{ _id: SubmissionType; ms: number; total: number }>([
      { $match: { status: "handled", statusUpdatedAt: { $ne: null } } },
      { $group: { _id: "$type", ms: { $sum: { $subtract: ["$statusUpdatedAt", "$createdAt"] } }, total: { $sum: 1 } } },
    ]),
    Submission.findOne({ status: "pending" }).sort({ createdAt: 1 }).select("createdAt").lean(),
    Submission.find().sort({ createdAt: -1 }).limit(6).select("type reference name subject status createdAt").lean(),
  ]);

  const emptyDay = () => Object.fromEntries(SUBMISSION_TYPES.map((t) => [t, 0])) as Record<SubmissionType, number>;
  const byDay = new Map(days.map((d) => [d, emptyDay()]));
  for (const row of daily) {
    const day = byDay.get(row._id.day);
    if (day && row._id.type in day) day[row._id.type] = row.total;
  }

  const hours = (ms: number, total: number) => (total > 0 ? Math.max(0, ms / total / 3_600_000) : null);
  const handlingByType = new Map(handling.map((h) => [h._id, h]));

  return {
    counts,
    days: days.map((date) => ({ date, ...(byDay.get(date) ?? emptyDay()) })),
    /** Average hours between reception and « Traitée »; null when nothing was handled yet. */
    handling: {
      hours: hours(
        handling.reduce((n, h) => n + h.ms, 0),
        handling.reduce((n, h) => n + h.total, 0),
      ),
      sample: handling.reduce((n, h) => n + h.total, 0),
      byType: Object.fromEntries(
        SUBMISSION_TYPES.map((t) => [t, hours(handlingByType.get(t)?.ms ?? 0, handlingByType.get(t)?.total ?? 0)]),
      ) as Record<SubmissionType, number | null>,
    },
    oldestPendingAt: oldestPending?.createdAt ?? null,
    latest: (latest as unknown as SubmissionDoc[]).map((s) => ({
      id: String(s._id),
      type: s.type,
      reference: s.reference,
      name: s.name,
      subject: s.subject,
      status: s.status,
      createdAt: s.createdAt,
    })),
  };
}

/** What the team did in the backoffice over the last 30 days. */
export async function activityStats() {
  const days = lastDays(ACTIVITY_DAYS);
  const since = new Date(Date.now() - (ACTIVITY_DAYS + 1) * DAY_MS);
  const match = { $match: { createdAt: { $gte: since } } };

  const [daily, byAction, byUser] = await Promise.all([
    Activity.aggregate<{ _id: string; total: number }>([match, { $group: { _id: dayOf, total: { $sum: 1 } } }]),
    Activity.aggregate<{ _id: { day: string; action: string }; total: number }>([
      match,
      { $group: { _id: { day: dayOf, action: "$action" }, total: { $sum: 1 } } },
    ]),
    Activity.aggregate<{ _id: { day: string; user: string }; total: number }>([
      match,
      { $group: { _id: { day: dayOf, user: "$userName" }, total: { $sum: 1 } } },
    ]),
  ]);

  // Only the days of the chart are counted, so every figure of the card covers the same period.
  const inRange = new Set(days);
  const perDay = new Map(daily.map((d) => [d._id, d.total]));
  const sumBy = <K extends string>(rows: { _id: Record<K, string> & { day: string }; total: number }[], key: K) => {
    const totals = new Map<string, number>();
    for (const row of rows) if (inRange.has(row._id.day)) totals.set(row._id[key], (totals.get(row._id[key]) ?? 0) + row.total);
    return [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  };

  const series = days.map((date) => ({ date, total: perDay.get(date) ?? 0 }));
  return {
    total: series.reduce((n, d) => n + d.total, 0),
    days: series,
    byAction: sumBy(byAction, "action").map(({ name, total }) => ({ action: name, total })),
    byUser: sumBy(byUser, "user")
      .slice(0, 5)
      .map(({ name, total }) => ({ userName: name, total })),
  };
}

/** Files of the media library, per kind. */
export async function mediaStats() {
  const rows = await Media.aggregate<{ _id: string; count: number; size: number }>([
    { $group: { _id: "$kind", count: { $sum: 1 }, size: { $sum: "$size" } } },
  ]);
  return rows.map((r) => ({ kind: r._id, count: r.count, size: r.size })).sort((a, b) => b.count - a.count);
}
