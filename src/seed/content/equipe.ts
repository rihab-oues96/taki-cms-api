import { defineSeed } from "../helpers.js";

/** Page « Notre équipe ». L'organigramme (niveaux et membres) fait partie de la section « organisation ». */
export default defineSeed({
  pages: [{ key: "equipe", label: "Notre équipe", path: "/notre-equipe", description: "Présentation vidéo, organigramme et appel à candidatures." }],
  sections: [
    {
      page: "equipe",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour les moteurs de recherche.",
      content: {
        title: "Notre équipe",
        description:
          "L'organisation de Taki Academy International School : direction, coordination IB, vie scolaire, enseignants et personnel de soutien.",
      },
      overrides: { title: { type: "text" }, description: { type: "textarea" } },
    },
    {
      page: "equipe",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre, chapô et boutons en haut de la page.",
      content: {
        eyebrow: "Notre équipe",
        title: "Des personnes engagées pour *chaque élève*.",
        lead: "De la direction à l'équipe enseignante, découvrez comment l'école est organisée et qui accompagne votre enfant au quotidien.",
        primaryCta: { label: "Contacter l'école", href: "/contact-us" },
        secondaryCta: { label: "Notre organisation", href: "#organisation" },
      },
    },
    {
      page: "equipe",
      key: "videos",
      label: "En vidéo",
      description: "Titre, texte et sélection de vidéos (choisies dans Contenus › Vidéos de l'école).",
      content: {
        eyebrow: "En vidéo",
        title: "Ils vous présentent *l'école*.",
        text: "Le système IB, le collège et le lycée, les journées portes ouvertes : nos équipes répondent à vos questions.",
        videoIds: [
          "https://www.youtube.com/shorts/P1xbK3xMsh4",
          "https://www.youtube.com/shorts/K6PEcv8nz6M",
          "https://www.youtube.com/shorts/3gIrBvwgayk",
          "https://www.youtube.com/shorts/Vnl3hxuyLyI",
          "https://www.youtube.com/shorts/FGGSW4olJa4",
          "https://www.youtube.com/shorts/92DKhdKTomQ",
        ],
      },
      overrides: {
        text: { type: "textarea" },
        videoIds: {
          label: "Vidéos affichées (liens YouTube)",
          help: "Chaque vidéo doit exister dans Contenus › Vidéos de l'école.",
        },
        "videoIds[]": { label: "Lien YouTube", type: "youtube" },
      },
    },
    {
      page: "equipe",
      key: "organisation",
      label: "Organigramme",
      description: "Titre du bloc, puis les niveaux de l'organigramme du haut vers le bas, avec leurs membres (fonction, nom, photo).",
      content: {
        eyebrow: "Notre organisation",
        title: "Six équipes, *un même projet*.",
        text: "Chaque équipe a son rôle, toutes travaillent ensemble pour la réussite et le bien-être des élèves.",
        namePlaceholder: "Prénom Nom",
        levels: [
          {
            title: "Direction générale",
            intro: "Elle porte la vision de l'école et garantit la fidélité aux valeurs de l'IB.",
            members: [
              { role: "Directeur / Directrice générale", name: "", photo: "", desc: "Pilotage stratégique et représentation de l'établissement." },
            ],
          },
          {
            title: "Direction de l'établissement",
            intro: "Elle assure la bonne marche pédagogique et administrative de l'école.",
            members: [
              { role: "Directeur pédagogique", name: "", photo: "", desc: "Qualité de l'enseignement et suivi des équipes." },
              { role: "Directeur administratif et financier", name: "", photo: "", desc: "Gestion administrative, financière et ressources humaines." },
            ],
          },
          {
            title: "Coordination IB",
            intro: "Elle met en œuvre les programmes de l'IB et accompagne les enseignants.",
            members: [
              { role: "Coordinateur du PEI", name: "", photo: "", desc: "Programme d'éducation intermédiaire, de 11 à 16 ans." },
              { role: "Coordinateur du DP", name: "", photo: "", desc: "Programme du diplôme, tronc commun et évaluations." },
              { role: "Coordinateur CAS", name: "", photo: "", desc: "Créativité, activité, service et projets des élèves." },
            ],
          },
          {
            title: "Vie scolaire et services aux élèves",
            intro: "Ils accompagnent chaque élève et chaque famille au quotidien.",
            members: [
              { role: "Conseiller principal d'éducation", name: "", photo: "", desc: "Vie scolaire, discipline et présences." },
              { role: "Conseiller d'orientation", name: "", photo: "", desc: "Orientation et préparation aux études supérieures." },
              { role: "Responsable des admissions", name: "", photo: "", desc: "Accueil des familles, visites et inscriptions." },
              { role: "Bibliothécaire", name: "", photo: "", desc: "Ressources, recherche documentaire et lecture." },
              { role: "Infirmier / Infirmière", name: "", photo: "", desc: "Santé et bien-être des élèves." },
            ],
          },
          {
            title: "Équipe enseignante",
            intro: "Des enseignants répartis dans les huit groupes de matières de l'IB.",
            members: [
              { role: "Langue et littérature", name: "", photo: "", desc: "" },
              { role: "Acquisition de langues", name: "", photo: "", desc: "" },
              { role: "Individus et sociétés", name: "", photo: "", desc: "" },
              { role: "Sciences", name: "", photo: "", desc: "" },
              { role: "Mathématiques", name: "", photo: "", desc: "" },
              { role: "Arts", name: "", photo: "", desc: "" },
              { role: "Design", name: "", photo: "", desc: "" },
              { role: "Éducation physique et santé", name: "", photo: "", desc: "" },
            ],
          },
          {
            title: "Administration et soutien",
            intro: "Ils font vivre l'école jour après jour.",
            members: [
              { role: "Secrétariat", name: "", photo: "", desc: "" },
              { role: "Comptabilité", name: "", photo: "", desc: "" },
              { role: "Informatique et multimédia", name: "", photo: "", desc: "" },
              { role: "Restauration", name: "", photo: "", desc: "" },
              { role: "Entretien et sécurité", name: "", photo: "", desc: "" },
            ],
          },
        ],
      },
      overrides: {
        text: { type: "textarea" },
        namePlaceholder: { label: "Texte affiché quand le nom d'un membre n'est pas renseigné" },
        levels: { label: "Niveaux de l'organigramme", help: "Du haut vers le bas. Le premier niveau est mis en avant." },
        "levels[]": { label: "Niveau" },
        "levels[].title": { type: "text" },
        "levels[].intro": { type: "textarea" },
        "levels[].members[]": { label: "Membre" },
        "levels[].members[].role": { label: "Fonction" },
        "levels[].members[].name": { label: "Nom (facultatif)" },
        "levels[].members[].photo": { label: "Photo (facultative)", help: "Portrait carré de préférence. Sans photo, une silhouette est affichée." },
        "levels[].members[].desc": { label: "Description (facultative)" },
      },
    },
    {
      page: "equipe",
      key: "join",
      label: "Rejoindre l'équipe",
      description: "Bloc d'appel à candidatures en bas de page.",
      content: {
        title: "Envie de rejoindre *notre équipe* ?",
        text: "Enseignants, encadrants, personnel administratif : découvrez nos offres et partagez notre projet éducatif.",
        primaryCta: { label: "Voir les offres d'emploi", href: "/jobs" },
        secondaryCta: { label: "Contactez-nous", href: "/contact-us" },
      },
      overrides: { text: { type: "textarea" } },
    },
  ],
});
