import { defineSeed } from "../helpers.js";

const CATEGORY_KEY = {
  label: "Rubrique",
  type: "select" as const,
  options: [
    { value: "articles", label: "articles" },
    { value: "events", label: "events" },
    { value: "ecole", label: "ecole" },
  ],
};

/**
 * Page « Actualités » (/actuality) et textes communs du gabarit d'article (/actuality/[slug]).
 * Les articles et les cartes du fil sont dans Contenus › Articles et Contenus › Fil d'actualités.
 */
export default defineSeed({
  pages: [
    { key: "actualites", label: "Actualités", path: "/actuality", description: "Page d'actualités : à la une, fil d'actualités, réseaux sociaux." },
    {
      key: "article",
      label: "Page d'un article (textes communs)",
      path: "/actuality",
      description: "Textes fixes affichés sur chaque article : fil d'Ariane, sommaire, partage, bloc de contact.",
    },
  ],
  sections: [
    {
      page: "actualites",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour Google et les réseaux sociaux.",
      content: {
        title: "Actualités",
        description: "Événements, vie de l’école et conseils pour les familles : suivez l’actualité de Taki Academy International School.",
      },
      overrides: { title: { type: "text", label: "Titre de la page" } },
    },
    {
      page: "actualites",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre et introduction en haut de la page.",
      content: {
        eyebrow: "Actualités",
        title: "Les nouvelles de *l’école*.",
        lead: "Événements, vie de l’école et conseils pour les familles : suivez tout ce qui se passe à TakiAcademy International School.",
      },
    },
    {
      page: "actualites",
      key: "featured",
      label: "À la une",
      description: "Grande carte mise en avant, avec une vidéo YouTube et un bouton.",
      content: {
        video: {
          id: "https://www.youtube.com/shorts/C2vAFbCxO_M",
          kind: "short",
          title: "L’entrée de TakiAcademy International School",
          thumb: "/media/programme/school-entrance.jpg",
        },
        playLabel: "Voir la vidéo",
        badge: "À la une",
        category: "Événements",
        title: "Le diplôme de l’IB officiellement reconnu en Tunisie",
        text: "Le diplôme du Baccalauréat International est officiellement reconnu par le Ministère de l’Enseignement Supérieur en Tunisie. Une étape historique pour notre école et pour les familles.",
        cta: { label: "Découvrir le Programme du diplôme", href: "/diploma-program" },
      },
      overrides: {
        "video.id": { label: "Lien YouTube", type: "youtube" },
        "video.kind": {
          label: "Format",
          type: "select",
          options: [
            { value: "short", label: "Short (vertical)" },
            { value: "long", label: "Vidéo (horizontale)" },
          ],
        },
        "video.title": { label: "Titre de la vidéo (accessibilité)", type: "text" },
        "video.thumb": { label: "Image de la carte" },
        playLabel: { label: "Libellé sur l'image" },
        category: { label: "Rubrique affichée" },
        title: { type: "text" },
        text: { type: "textarea" },
      },
    },
    {
      page: "actualites",
      key: "grid",
      label: "Fil d'actualités (titre, filtres, libellés)",
      description: "Titre, filtres et libellés des cartes. Les cartes se gèrent dans Contenus › Fil d'actualités.",
      content: {
        title: "Toutes les *actualités*.",
        filterAriaLabel: "Filtrer les actualités",
        allLabel: "Tout",
        categories: [
          { key: "articles", label: "Articles" },
          { key: "events", label: "Événements" },
          { key: "ecole", label: "Vie de l’école" },
        ],
        articleLinkLabel: "Lire l’article",
        videoLinkLabel: "Voir la vidéo",
      },
      overrides: {
        filterAriaLabel: { label: "Nom du groupe de filtres (accessibilité)" },
        allLabel: { label: "Libellé du filtre « tout »" },
        categories: { label: "Rubriques (filtres et étiquettes des cartes)" },
        "categories[].key": CATEGORY_KEY,
        "categories[].label": { label: "Nom affiché" },
        articleLinkLabel: { label: "Libellé du lien d'un article", type: "text" },
        videoLinkLabel: { label: "Libellé du lien d'une vidéo", type: "text" },
      },
    },
    {
      page: "actualites",
      key: "social",
      label: "Suivez-nous (réseaux sociaux)",
      description: "Liste des réseaux sociaux en bas de page.",
      content: {
        eyebrow: "Suivez-nous",
        title: "La vie de l’école, *au jour le jour*.",
        lead: "Photos, reels et actualités : retrouvez chaque moment sur nos réseaux.",
        items: [
          { network: "instagram", name: "Instagram", handle: "@takiacademy.international", desc: "Photos et reels du quotidien" },
          { network: "facebook", name: "Facebook", handle: "TakiAcademy.International", desc: "Actualités et événements" },
          { network: "youtube", name: "YouTube", handle: "@TakiAcademy.International", desc: "Toutes nos vidéos" },
          { network: "linkedin", name: "LinkedIn", handle: "TakiAcademy International School", desc: "La vie de l’établissement" },
        ],
      },
      overrides: {
        items: { label: "Réseaux" },
        "items[].network": {
          label: "Réseau",
          type: "select",
          help: "Le lien vient de Éléments communs › Identité et coordonnées › Réseaux sociaux.",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "facebook", label: "Facebook" },
            { value: "youtube", label: "YouTube" },
            { value: "linkedin", label: "LinkedIn" },
          ],
        },
        "items[].name": { label: "Nom affiché" },
        "items[].handle": { label: "Nom du compte" },
      },
    },

    /* ----------------------------- gabarit d'article ----------------------------- */
    {
      page: "article",
      key: "header",
      label: "En-tête de l'article",
      description: "Fil d'Ariane, auteur et temps de lecture affichés sous le titre de chaque article.",
      content: {
        breadcrumbAriaLabel: "Fil d’Ariane",
        back: { label: "Actualités", href: "/actuality" },
        authorLogo: "/brand/logo-light.svg",
        authorName: "TakiAcademy International School",
        readingTime: "{minutes} min de lecture",
      },
      overrides: {
        breadcrumbAriaLabel: { label: "Nom du fil d'Ariane (accessibilité)" },
        back: { label: "Lien de retour" },
        authorLogo: { label: "Logo de l'auteur" },
        authorName: { label: "Nom de l'auteur" },
        readingTime: { label: "Temps de lecture", help: "{minutes} est remplacé par le nombre de minutes." },
      },
    },
    {
      page: "article",
      key: "body",
      label: "Corps de l'article (libellés)",
      description: "Libellés du sommaire, du partage et de l'encadré « L'essentiel ».",
      content: {
        ariaLabel: "Article",
        keyPointsTitle: "L’essentiel",
        tableCriterionLabel: "Critère",
        tocTitle: "Sommaire",
        shareTitle: "Partager",
        shareFacebook: "Partager sur Facebook",
        shareLinkedin: "Partager sur LinkedIn",
        shareWhatsapp: "Partager sur WhatsApp",
        copyLabel: "Copier le lien",
        copiedLabel: "Lien copié",
      },
      overrides: {
        ariaLabel: { label: "Nom de la zone d'article (accessibilité)" },
        keyPointsTitle: { label: "Titre de l'encadré des points clés", type: "text" },
        tableCriterionLabel: { label: "En-tête masqué de la 1re colonne du tableau (accessibilité)" },
        tocTitle: { label: "Titre du sommaire", type: "text" },
        shareTitle: { label: "Titre du partage", type: "text" },
        shareFacebook: { label: "Bouton Facebook (accessibilité)" },
        shareLinkedin: { label: "Bouton LinkedIn (accessibilité)" },
        shareWhatsapp: { label: "Bouton WhatsApp (accessibilité)" },
        copyLabel: { label: "Bouton « copier le lien » (accessibilité)" },
        copiedLabel: { label: "Message après copie" },
      },
    },
    {
      page: "article",
      key: "contact",
      label: "Bloc de contact",
      description: "Encadré bleu sous chaque article. Le numéro de téléphone vient de Éléments communs.",
      content: {
        title: "Une question sur *le programme IB* ?",
        text: "Notre équipe des admissions répond à toutes vos questions et vous accompagne dans l’inscription de votre enfant.",
        primaryCta: { label: "Pré-inscription", href: "/admission" },
        secondaryCta: { label: "Contactez-nous", href: "/contact-us" },
        phoneText: "Ou appelez les admissions au",
      },
      overrides: { text: { type: "textarea" }, phoneText: { label: "Texte avant le numéro de téléphone" } },
    },
    {
      page: "article",
      key: "more",
      label: "À lire aussi",
      description: "Titre et lien au-dessus des trois actualités proposées en fin d'article.",
      content: {
        title: "À lire *aussi*.",
        link: { label: "Toutes les actualités", href: "/actuality" },
      },
      overrides: { link: { label: "Lien « tout voir »" } },
    },
  ],
});
