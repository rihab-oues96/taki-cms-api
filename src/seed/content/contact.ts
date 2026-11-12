import { defineSeed } from "../helpers.js";

const SEO_OVERRIDES = {
  title: { label: "Titre de l'onglet (référencement)", type: "text" as const },
  description: { label: "Description pour les moteurs de recherche", type: "textarea" as const },
};

/**
 * Texts shown while a form is being sent and once it has been received. The three forms
 * have the same set; `messages()` only changes the wording of the confirmation.
 */
const messages = (successTitle: string, successText: string, again: string) => ({
  sending: "Envoi en cours…",
  successTitle,
  successText,
  reference: "Référence de votre demande",
  again,
  invalid: "Certains champs sont à corriger. Vérifiez les informations signalées puis réessayez.",
  error: "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez dans un instant.",
  tooMany: "Trop d'envois depuis votre connexion. Réessayez dans quelques minutes.",
});

const FORM_NOTES = {
  submit: { label: "Bouton d'envoi" },
  note: { label: "Note sous le bouton", type: "textarea" as const },
  labels: { label: "Libellés des champs" },
  messages: { label: "Messages d'envoi et de confirmation" },
  "messages.sending": { label: "Bouton pendant l'envoi", type: "text" as const },
  "messages.successTitle": { label: "Confirmation : titre", type: "text" as const },
  "messages.successText": { label: "Confirmation : texte", type: "textarea" as const },
  "messages.reference": { label: "Confirmation : intitulé de la référence", type: "text" as const },
  "messages.again": { label: "Confirmation : bouton pour envoyer une autre demande", type: "text" as const },
  "messages.invalid": { label: "Erreur : champs à corriger", type: "textarea" as const },
  "messages.error": { label: "Erreur : envoi impossible", type: "textarea" as const },
  "messages.tooMany": { label: "Erreur : trop d'envois", type: "textarea" as const },
};

/** Pré-inscription, Contact and Offres d'emploi pages, including the texts of their forms. */
export default defineSeed({
  pages: [
    { key: "admission", label: "Pré-inscription", path: "/admission", description: "Étapes, fiche de pré-inscription et bloc d'aide." },
    { key: "contact", label: "Contact", path: "/contact-us", description: "Formulaire de contact, coordonnées des admissions et carte." },
    { key: "jobs", label: "Offres d'emploi", path: "/jobs", description: "Offres ouvertes et candidature spontanée." },
  ],
  sections: [
    /* ------------------------------ /admission ------------------------------ */
    {
      page: "admission",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour les moteurs de recherche.",
      content: {
        title: "Pré-inscription",
        description:
          "Inscrivez votre enfant à Taki Academy International School (Sahloul, Sousse) : remplissez la fiche de pré-inscription 2026-2027 en ligne.",
      },
      overrides: SEO_OVERRIDES,
    },
    {
      page: "admission",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre de la page, chapô et deux boutons.",
      content: {
        eyebrow: "Pré-inscription",
        title: "Inscrivez-vous pour une *expérience hors du commun*",
        lead: "Rejoignez Taki Academy et accédez à un programme de classe mondiale menant au diplôme du Baccalauréat International.",
        primaryCta: { label: "Remplir la fiche", href: "#inscription" },
        secondaryCta: { label: "Réserver une visite", href: "/contact-us#visit" },
      },
    },
    {
      page: "admission",
      key: "steps",
      label: "Les étapes",
      description: "Cartes numérotées qui résument le parcours d'inscription.",
      content: {
        ariaLabel: "Les étapes",
        items: [
          { title: "Choisir l’inscription", text: "Sélectionnez le niveau et la classe de votre enfant." },
          { title: "Présenter votre enfant", text: "Son identité et son parcours scolaire." },
          { title: "Vos coordonnées", text: "Celles du parent ou du responsable légal." },
          { title: "Envoyer", text: "Validez le formulaire, notre équipe revient vers vous pour la suite." },
        ],
      },
      overrides: {
        ariaLabel: { label: "Nom du bloc (accessibilité)" },
        items: { label: "Étapes" },
        "items[]": { label: "Étape" },
        "items[].title": { type: "text" },
      },
    },
    {
      page: "admission",
      key: "form",
      label: "Fiche de pré-inscription",
      description: "Titre du bloc et tous les textes du formulaire (libellés, choix, messages).",
      content: {
        eyebrow: "Inscription 2026 – 2027",
        title: "Fiche de pré-inscription",
        text: "Remplissez les informations ci-dessous. Tous les champs sont obligatoires, sauf indication contraire.",
        parentTitle: "Informations du parent",
        studentTitle: "Informations de l’élève",
        previousTitle: "École précédente",
        labels: {
          firstName: "Prénom",
          lastName: "Nom",
          phone: "Téléphone",
          email: "E-mail",
          address: "Adresse",
          gender: "Genre",
          nationality: "Nationalité",
          birthdate: "Date de naissance",
          birthplace: "Lieu de naissance",
          level: "Niveau",
          grade: "Classe",
          studentPhone: "Téléphone de l’élève (facultatif)",
        },
        genderOptions: ["Garçon", "Fille"],
        levelOptions: [
          { value: "PEI", label: "Programme d’éducation intermédiaire (PEI)" },
          { value: "DP", label: "Programme du diplôme (DP)" },
        ],
        previousOptions: [
          { value: "En Tunisie", label: "Locale" },
          { value: "À l’étranger", label: "Étranger" },
        ],
        submit: "Envoyer la pré-inscription",
        note: "Votre demande est transmise directement à notre équipe des admissions, qui vous recontacte pour la suite de l'inscription.",
        messages: messages(
          "Votre pré-inscription a bien été envoyée",
          "Merci ! Notre équipe des admissions étudie votre demande et vous recontacte très prochainement pour la suite de l'inscription.",
          "Envoyer une autre pré-inscription",
        ),
      },
      overrides: {
        ...FORM_NOTES,
        title: { type: "text" },
        text: { label: "Texte d'introduction", type: "textarea" },
        parentTitle: { label: "Titre du groupe « parent »" },
        studentTitle: { label: "Titre du groupe « élève »" },
        previousTitle: { label: "Titre du groupe « école précédente »" },
        "labels.firstName": { label: "Prénom" },
        "labels.lastName": { label: "Nom" },
        "labels.phone": { label: "Téléphone" },
        "labels.email": { label: "E-mail" },
        "labels.address": { label: "Adresse" },
        "labels.gender": { label: "Genre" },
        "labels.nationality": { label: "Nationalité" },
        "labels.birthdate": { label: "Date de naissance", type: "text" },
        "labels.birthplace": { label: "Lieu de naissance" },
        "labels.level": { label: "Niveau" },
        "labels.grade": { label: "Classe" },
        "labels.studentPhone": { label: "Téléphone de l'élève" },
        genderOptions: { label: "Choix « genre »" },
        "genderOptions[]": { label: "Choix" },
        levelOptions: { label: "Choix « niveau »" },
        "levelOptions[]": { label: "Choix" },
        "levelOptions[].value": { label: "Valeur envoyée" },
        previousOptions: { label: "Choix « école précédente »" },
        "previousOptions[]": { label: "Choix" },
        "previousOptions[].value": { label: "Valeur envoyée" },
        "previousOptions[].label": { label: "Libellé du bouton" },
      },
    },
    {
      page: "admission",
      key: "help",
      label: "Bloc d'aide",
      description: "Encadré bleu à côté du formulaire. Les coordonnées viennent de Éléments communs › Identité et coordonnées.",
      content: {
        title: "Besoin d’aide ?",
        text: "Notre équipe vous accompagne pendant toute l’inscription.",
        cta: { label: "Contactez-nous", href: "/contact-us" },
      },
      overrides: { title: { type: "text" } },
    },

    /* ------------------------------ /contact-us ----------------------------- */
    {
      page: "contact",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour les moteurs de recherche.",
      content: {
        title: "Contactez-nous",
        description:
          "Contactez l'équipe des admissions de Taki Academy International School à Sahloul, Sousse, ou réservez une visite de l'école.",
      },
      overrides: SEO_OVERRIDES,
    },
    {
      page: "contact",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre de la page et chapô.",
      content: {
        eyebrow: "Contactez-nous",
        title: "Parlons de *l'avenir de votre enfant*",
        lead: "Notre équipe des admissions se fera un plaisir de répondre à vos questions et de vous accueillir à l'école.",
      },
    },
    {
      page: "contact",
      key: "form",
      label: "Formulaire de contact",
      description: "Titre du bloc et tous les textes du formulaire (libellés, sujets, messages).",
      content: {
        title: "Réservez une visite ou posez une question",
        text: "Parlez-nous un peu de votre famille et nous reviendrons vers vous.",
        labels: {
          name: "Nom du parent / tuteur",
          phone: "Téléphone",
          email: "E-mail",
          grade: "Classe actuelle de l'enfant (facultatif)",
          topic: "Je souhaite",
          message: "Message",
        },
        topics: [
          "Réserver une visite de l'école",
          "Me renseigner sur le Programme d'éducation intermédiaire (PEI)",
          "Me renseigner sur le Programme du diplôme (DP)",
          "Commencer la pré-inscription",
          "Autre demande",
        ],
        submit: "Envoyer aux admissions",
        note: "Votre message est transmis directement à notre équipe des admissions, qui vous répond dans les meilleurs délais.",
        messages: messages(
          "Votre message a bien été envoyé",
          "Merci ! Notre équipe des admissions vous répond dans les meilleurs délais.",
          "Envoyer un autre message",
        ),
      },
      overrides: {
        ...FORM_NOTES,
        title: { type: "text" },
        text: { label: "Texte d'introduction" },
        "labels.name": { label: "Nom" },
        "labels.phone": { label: "Téléphone" },
        "labels.email": { label: "E-mail" },
        "labels.grade": { label: "Classe de l'enfant" },
        "labels.topic": { label: "Sujet de la demande" },
        "labels.message": { label: "Message" },
        topics: { label: "Sujets proposés (le premier est sélectionné par défaut)" },
        "topics[]": { label: "Sujet", type: "text" },
      },
    },
    {
      page: "contact",
      key: "info",
      label: "Coordonnées et réseaux",
      description:
        "Encadrés à droite du formulaire. Adresse, téléphone, e-mail et réseaux viennent de Éléments communs › Identité et coordonnées.",
      content: {
        title: "Admissions",
        visitNote: "Appelez-nous ou écrivez-nous pour convenir d'un horaire de visite qui vous convient.",
        cta: { label: "Pré-inscription en ligne", href: "/admission" },
        followTitle: "Suivez-nous",
      },
      overrides: {
        title: { type: "text" },
        visitNote: { label: "Note sur les horaires de visite" },
        followTitle: { label: "Titre du bloc réseaux sociaux" },
      },
    },
    {
      page: "contact",
      key: "map",
      label: "Carte",
      description: "Carte Google Maps. Le lieu affiché vient de Éléments communs › Identité et coordonnées.",
      content: {
        ariaLabel: "Carte",
        title: "Taki Academy International School sur la carte",
      },
      overrides: {
        ariaLabel: { label: "Nom du bloc (accessibilité)" },
        title: { label: "Titre de la carte (accessibilité)", type: "text" },
      },
    },

    /* --------------------------------- /jobs -------------------------------- */
    {
      page: "jobs",
      key: "seo",
      label: "Référencement",
      description: "Titre et description de la page pour les moteurs de recherche.",
      content: {
        title: "Recrutement",
        description:
          "Rejoignez l'équipe de Taki Academy International School : consultez nos offres d'emploi ou envoyez-nous une candidature spontanée.",
      },
      overrides: SEO_OVERRIDES,
    },
    {
      page: "jobs",
      key: "hero",
      label: "Bandeau d'en-tête",
      description: "Titre de la page, chapô et bouton.",
      content: {
        eyebrow: "Recrutement",
        title: "Rejoignez *notre équipe*",
        lead: "Nous recherchons des talents passionnés pour transformer l'éducation et créer l'avenir ensemble.",
        cta: { label: "Envoyer une candidature", href: "#candidature" },
      },
    },
    {
      page: "jobs",
      key: "offers",
      label: "Offres d'emploi",
      description: "Liste des postes ouverts. Sans offre, le message « aucune offre » s'affiche.",
      content: {
        title: "Offres d'emploi",
        emptyTitle: "Aucune offre disponible pour le moment",
        emptyText:
          "Déposez votre CV et complétez vos informations afin que nous puissions vous contacter dès qu'une opportunité se présente.",
        items: [],
      },
      overrides: {
        title: { label: "Titre du bloc (accessibilité)", type: "text" },
        emptyTitle: { label: "Sans offre : titre" },
        emptyText: { label: "Sans offre : texte" },
        items: {
          label: "Offres",
          item: {
            name: "item",
            label: "Offre",
            type: "group",
            fields: [
              { name: "title", label: "Intitulé du poste", type: "text" },
              { name: "type", label: "Type de contrat", type: "text" },
              { name: "description", label: "Description", type: "textarea" },
            ],
          },
        },
      },
    },
    {
      page: "jobs",
      key: "apply",
      label: "Candidature spontanée",
      description: "Titre du bloc et tous les textes du formulaire de candidature (libellés, CV, messages).",
      content: {
        title: "Envoyez-nous *votre candidature*",
        text: "Parlez-nous de votre parcours : nous conservons chaque candidature et revenons vers vous dès qu'un poste correspond à votre profil.",
        labels: {
          name: "Nom et prénom",
          phone: "Téléphone",
          email: "E-mail",
          role: "Poste souhaité",
          cvFile: "Votre CV",
          cv: "Profil LinkedIn ou portfolio (facultatif)",
          message: "Message",
        },
        placeholders: { role: "Ex. Enseignant de mathématiques", cv: "https://" },
        cvHelp: "PDF ou Word (.docx), 5 Mo maximum.",
        submit: "Envoyer une candidature",
        note: "Votre candidature et votre CV sont transmis directement à notre équipe, qui les conserve en toute confidentialité.",
        messages: {
          ...messages(
            "Votre candidature a bien été envoyée",
            "Merci ! Nous étudions votre profil et revenons vers vous dès qu'un poste lui correspond.",
            "Envoyer une autre candidature",
          ),
          fileMissing: "Veuillez joindre votre CV.",
          fileType: "Format non accepté : envoyez votre CV en PDF ou Word (.docx).",
          fileSize: "Votre CV dépasse la taille maximale de 5 Mo.",
        },
      },
      overrides: {
        ...FORM_NOTES,
        text: { label: "Texte d'introduction" },
        "labels.name": { label: "Nom" },
        "labels.phone": { label: "Téléphone" },
        "labels.email": { label: "E-mail" },
        "labels.role": { label: "Poste souhaité" },
        "labels.cvFile": { label: "Fichier du CV" },
        "labels.cv": { label: "Lien vers un profil en ligne", type: "text" },
        "labels.message": { label: "Message" },
        placeholders: { label: "Textes indicatifs dans les champs" },
        "placeholders.role": { label: "Poste souhaité" },
        "placeholders.cv": { label: "Lien vers un profil en ligne", type: "text" },
        cvHelp: { label: "Aide sous le champ du CV (formats et taille acceptés)", type: "text" },
        "messages.fileMissing": { label: "Erreur : CV manquant", type: "text" },
        "messages.fileType": { label: "Erreur : format du CV non accepté", type: "text" },
        "messages.fileSize": { label: "Erreur : CV trop volumineux", type: "text" },
      },
    },
    {
      page: "jobs",
      key: "help",
      label: "Bloc « Une question ? »",
      description: "Encadré bleu à côté du formulaire. Les coordonnées viennent de Éléments communs › Identité et coordonnées.",
      content: { title: "Une question ?" },
      overrides: { title: { type: "text" } },
    },
  ],
});
