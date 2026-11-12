import type { SeedModule } from "../helpers.js";
import actualites from "./actualites.js";
import contact from "./contact.js";
import entries from "./entries.js";
import equipe from "./equipe.js";
import global from "./global.js";
import home from "./home.js";
import home2 from "./home-2.js";
import mission from "./mission.js";
import notFound from "./not-found.js";
import politiques from "./politiques.js";
import programmes from "./programmes.js";
import vieScolaire from "./vie-scolaire.js";

/**
 * Order here is the order of pages, sections and content types in the backoffice.
 * The key is the name accepted by `npm run seed -- --only=<name>[,<name>]`.
 */
export const SEED_MODULES: Record<string, SeedModule> = {
  global,
  home,
  "home-2": home2,
  mission,
  programmes,
  "vie-scolaire": vieScolaire,
  equipe,
  politiques,
  actualites,
  contact,
  "not-found": notFound,
  entries,
};
