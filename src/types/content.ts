export const FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "image",
  "url",
  "youtube",
  "number",
  "boolean",
  "select",
  "date",
  "group",
  "list",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Describes one editable value. Definitions are stored next to the content so the
 * backoffice can render any section or entry without knowing it in advance.
 *
 * - `richtext` is plain text with a tiny inline markup: `*mot*` highlights a word,
 *   a line break starts a new line.
 * - `youtube` is the full link of a YouTube video, as copied from the address bar or "Share".
 * - `group` nests `fields`; `list` repeats `item` (any definition, including a group).
 */
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  fields?: FieldDef[];
  item?: FieldDef;
}

export type ContentValue = string | number | boolean | null | ContentValue[] | { [key: string]: ContentValue };
