import type { Language } from "./data/missions";

export const copy = {
  fr: {
    navHome: "Accueil", navMissions: "Missions", solo: "MODE SOLO", eyebrow: "MISSION CONTROL · ACCÈS SOLO",
    homeTitle: "L'espace ne se conquiert pas par hasard.", homeBody: "Concevez des missions, arbitrez entre science et contraintes, et prenez des décisions qui comptent. Votre première mission vous attend.",
    start: "Commencer une partie solo", browse: "Explorer les missions", homeFoot: "3 missions · briefing interactif · progression à votre rythme",
    catalogEyebrow: "SÉLECTION DE MISSION", catalogTitle: "Votre prochaine frontière.", catalogBody: "Choisissez une mission pour consulter le briefing et préparer votre plan de vol.",
    available: "MISSIONS DISPONIBLES", select: "Consulter le briefing", difficulty: "Difficulté", objectives: "Objectif de mission", destination: "Destination", duration: "Durée",
    easy: "Initiation", medium: "Intermédiaire", hard: "Expert", back: "Retour au catalogue", briefing: "BRIEFING DE MISSION", primary: "OBJECTIFS PRINCIPAUX", secondary: "OBJECTIFS SECONDAIRES",
    constraints: "CONTRAINTES TECHNIQUES", resources: "RESSOURCES DISPONIBLES", estimated: "Coût estimé", confirm: "Valider le briefing", confirmed: "Briefing validé", nextReady: "Mission prête pour la prochaine étape.", nextPending: "Le constructeur de vaisseau sera disponible dans une prochaine étape.",
    notFound: "Mission introuvable", notFoundBody: "Cette mission n'existe pas dans le catalogue.", goHome: "Retour à l'accueil", language: "Langue", footer: "TERA VISION · BUILD YOUR WAY TO SPACE", missionNumber: "MISSION", stage: "ÉTAPE 01 / 07", launchStatus: "SYSTÈMES EN LIGNE",
  },
  en: {
    navHome: "Home", navMissions: "Missions", solo: "SOLO MODE", eyebrow: "MISSION CONTROL · SOLO ACCESS",
    homeTitle: "Space is not conquered by chance.", homeBody: "Design missions, balance science against constraints, and make decisions that matter. Your first mission is waiting.",
    start: "Start a solo game", browse: "Explore missions", homeFoot: "3 missions · interactive briefings · play at your pace",
    catalogEyebrow: "MISSION SELECTION", catalogTitle: "Your next frontier.", catalogBody: "Choose a mission to review its briefing and prepare your flight plan.",
    available: "AVAILABLE MISSIONS", select: "Review briefing", difficulty: "Difficulty", objectives: "Mission objective", destination: "Destination", duration: "Duration",
    easy: "Introductory", medium: "Intermediate", hard: "Expert", back: "Back to catalogue", briefing: "MISSION BRIEFING", primary: "PRIMARY OBJECTIVES", secondary: "SECONDARY OBJECTIVES",
    constraints: "TECHNICAL CONSTRAINTS", resources: "AVAILABLE RESOURCES", estimated: "Estimated cost", confirm: "Confirm briefing", confirmed: "Briefing confirmed", nextReady: "Mission ready for the next stage.", nextPending: "The spacecraft designer will be available in a future step.",
    notFound: "Mission not found", notFoundBody: "This mission is not in the catalogue.", goHome: "Return home", language: "Language", footer: "TERA VISION · BUILD YOUR WAY TO SPACE", missionNumber: "MISSION", stage: "STAGE 01 / 07", launchStatus: "SYSTEMS ONLINE",
  },
} satisfies Record<Language, Record<string, string>>;
