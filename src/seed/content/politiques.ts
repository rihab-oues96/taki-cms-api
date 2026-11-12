import { defineSeed } from "../helpers.js";

/** Page « Politiques de l'établissement ». Les politiques elles-mêmes sont le type de contenu « policies ». */
export default defineSeed({
  pages: [
    {
      key: "politiques",
      label: "Politiques de l'établissement",
      path: "/establishment-policies",
      description: "En-tête, lecteur de politiques et bloc de contact.",
    },
  ],
  sections: [
    {
      page: "politiques",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour les moteurs de recherche.",
      content: {
        title: "Politiques de l'établissement",
        description:
          "Admission, évaluation, inclusion, intégrité, langues et gestion des plaintes : les politiques de Taki Academy International School, pour le PEI et le DP de l'IB.",
      },
      overrides: { title: { type: "text" }, description: { type: "textarea" } },
    },
    {
      page: "politiques",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre, chapô et bouton en haut de la page.",
      content: {
        eyebrow: "Politiques de l'établissement",
        title: "Des règles claires, pour une *école de confiance*",
        lead: "Six politiques guident notre fonctionnement au quotidien, dans le PEI comme dans le Programme du diplôme de l'IB : elles sont écrites pour que les familles sachent à quoi s'attendre.",
        cta: { label: "Poser une question", href: "/contact-us" },
      },
    },
    {
      page: "politiques",
      key: "viewer",
      label: "Lecteur de politiques",
      description: "Libellés du lecteur. Les politiques se gèrent dans Contenus › Politiques de l'établissement.",
      content: {
        listTitle: "Nos politiques",
        tabsLabel: "Politiques de l'établissement",
      },
      overrides: {
        listTitle: { label: "Titre de la liste" },
        tabsLabel: { label: "Nom de la liste (accessibilité)" },
      },
    },
    {
      page: "politiques",
      key: "contact",
      label: "Une question ?",
      description: "Bloc de contact en bas de page.",
      content: {
        title: "Une question sur l'une de nos politiques ?",
        text: "Les parents peuvent aussi poser leurs questions et suivre leurs demandes via la plateforme Webschool, canal officiel de communication avec l'école.",
        portalCta: { label: "Portail parents", href: "https://ib.webschool.tn/parent/login" },
        contactCta: { label: "Contacter l'école", href: "/contact-us" },
      },
      overrides: {
        title: { type: "text" },
        text: { type: "textarea" },
        portalCta: { label: "Bouton portail (nouvel onglet)" },
        contactCta: { label: "Bouton contact" },
      },
    },
  ],
});
