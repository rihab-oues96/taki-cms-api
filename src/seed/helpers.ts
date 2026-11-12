import type { FieldDef } from "../types/content.js";
import type { FieldOverrides } from "../utils/fields.js";

/**
 * Seed format. Each file in ./content exports a SeedModule describing the content
 * that used to be hardcoded in the website. Field definitions are inferred from the
 * content itself; use `overrides` (keyed by path, e.g. "cta.href" or "items[].photo")
 * to fix a type or a label, and `fields` to describe the structure by hand.
 */
export interface SeedPage {
  key: string;
  label: string;
  path: string;
  description?: string;
}

export interface SeedSection {
  page: string;
  key: string;
  label: string;
  description?: string;
  restricted?: boolean;
  /**
   * An older section this one takes over (after a move or a rename). Its values are carried
   * into the new section for the fields they share, then the old section is removed.
   */
  replaces?: { page: string; key: string };
  content: Record<string, unknown>;
  fields?: FieldDef[];
  overrides?: FieldOverrides;
}

export interface SeedContentType {
  key: string;
  label: string;
  singular: string;
  description?: string;
  titleField: string;
  subtitleField?: string;
  imageField?: string;
  hasSlug?: boolean;
  previewPath?: string;
  fields?: FieldDef[];
  overrides?: FieldOverrides;
}

export interface SeedEntry {
  type: string;
  slug?: string;
  visible?: boolean;
  data: Record<string, unknown>;
}

export interface SeedModule {
  pages?: SeedPage[];
  sections?: SeedSection[];
  contentTypes?: SeedContentType[];
  entries?: SeedEntry[];
}

export const defineSeed = (module: SeedModule): SeedModule => module;
