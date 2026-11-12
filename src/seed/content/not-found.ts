import { defineSeed } from "../helpers.js";

/** The 404 page: shown for any address that does not exist on the website. */
export default defineSeed({
  pages: [
    {
      key: "not-found",
      label: "Page introuvable (404)",
      // Not a real page: any unknown address shows it, this one is used by "Voir la page" and the preview.
      path: "/404",
      description: "Page affichée quand l'adresse demandée n'existe pas ou plus (lien cassé, faute de frappe, contenu supprimé).",
    },
  ],
  sections: [
    {
      page: "not-found",
      key: "seo",
      label: "Référencement",
      description: "Titre de l'onglet du navigateur. Cette page n'est jamais indexée par les moteurs de recherche.",
      content: {
        title: "Page introuvable",
        description: "La page que vous cherchez n'existe pas ou a été déplacée.",
      },
      overrides: {
        title: { label: "Titre de l'onglet", type: "text" },
        description: { label: "Description", type: "textarea" },
      },
    },
    {
      page: "not-found",
      key: "message",
      label: "Message",
      description: "Grand chiffre, titre, texte et boutons. Si cette section est masquée, un message par défaut s'affiche.",
      // Takes over the block that used to live in Éléments communs.
      replaces: { page: "global", key: "notFound" },
      content: {
        code: "404",
        eyebrow: "Page introuvable",
        title: "Cette page *s'est égarée*",
        text: "L'adresse est peut-être incorrecte, ou la page a été déplacée. Retournons à l'école.",
        cta: { label: "Retour à l'accueil", href: "/" },
        secondaryCta: { label: "Contactez-nous", href: "/contact-us" },
      },
      overrides: {
        code: { label: "Grand chiffre" },
        eyebrow: { label: "Surtitre" },
        text: { type: "textarea" },
        cta: { label: "Bouton principal" },
        secondaryCta: { label: "Bouton secondaire", help: "Laissez le libellé vide pour ne pas afficher ce bouton." },
      },
    },
    {
      page: "not-found",
      key: "links",
      label: "Pages utiles",
      description: "Raccourcis proposés sous le message pour aider le visiteur à retrouver son chemin.",
      content: {
        title: "Vous cherchiez peut-être",
        items: [
          { label: "Nos programmes", text: "Le PEI et le Programme du diplôme de l'IB.", href: "/middle-education-program" },
          { label: "Pré-inscription", text: "Inscrivez votre enfant en ligne.", href: "/admission" },
          { label: "Actualités", text: "Les dernières nouvelles de l'école.", href: "/actuality" },
          { label: "Vie scolaire", text: "Le quotidien de nos élèves.", href: "/scholar-life" },
        ],
      },
      overrides: {
        title: { type: "text" },
        items: { label: "Raccourcis" },
        "items[]": { label: "Raccourci" },
        "items[].label": { label: "Nom de la page" },
        "items[].text": { label: "Courte description", type: "text" },
        "items[].href": { label: "Lien" },
      },
    },
  ],
});
