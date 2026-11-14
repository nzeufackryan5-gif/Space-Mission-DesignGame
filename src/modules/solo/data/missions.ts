import type { Mission } from "@/shared/types";

export type Language = "fr" | "en";

export interface MissionBriefing {
  mission: Mission;
  localizedMission: Record<Language, { name: string; description: string; objective: string; destination: string }>;
  codename: string;
  estimatedCost: number;
  primaryObjectives: Record<Language, string[]>;
  secondaryObjectives: Record<Language, string[]>;
  constraints: Record<Language, string[]>;
  resources: Record<Language, { label: string; value: string }[]>;
  tags: Record<Language, string[]>;
}

/** Catalogue de départ : les propriétés Mission suivent le contrat partagé. */
export const missions: MissionBriefing[] = [
  {
    mission: {
      id: "lunar-relay",
      name: "Lunar Relay",
      description: "Déployez un relais de communication autour de la Lune pour reconnecter les équipes d'exploration à la Terre.",
      objective: "Mettre en service un relais lunaire et maintenir une liaison stable avec la Terre.",
      difficulty: "easy",
      destination: "Orbite lunaire",
      durationDays: 14,
      budgetLimit: 180,
      maxSpacecraftMass: 950,
    },
    localizedMission: {
      fr: { name: "Lunar Relay", description: "Déployez un relais de communication autour de la Lune pour reconnecter les équipes d'exploration à la Terre.", objective: "Mettre en service un relais lunaire et maintenir une liaison stable avec la Terre.", destination: "Orbite lunaire" },
      en: { name: "Lunar Relay", description: "Deploy a communications relay around the Moon to reconnect exploration teams with Earth.", objective: "Commission a lunar relay and maintain a stable link with Earth.", destination: "Lunar orbit" },
    },
    codename: "ORBITAL NETWORK / 01",
    estimatedCost: 126,
    primaryObjectives: {
      fr: ["Placer le relais sur une orbite lunaire stable.", "Établir une liaison de communication avec la Terre."],
      en: ["Place the relay in a stable lunar orbit.", "Establish a communications link with Earth."],
    },
    secondaryObjectives: {
      fr: ["Transmettre un jeu de données de calibration.", "Terminer la mission en moins de 14 jours."],
      en: ["Transmit a calibration data set.", "Complete the mission within 14 days."],
    },
    constraints: {
      fr: ["Masse maximale du vaisseau : 950 kg", "Budget maximal : 180 crédits", "Fenêtre de mission : 14 jours"],
      en: ["Maximum spacecraft mass: 950 kg", "Maximum budget: 180 credits", "Mission window: 14 days"],
    },
    resources: {
      fr: [{ label: "Budget disponible", value: "180 cr" }, { label: "Masse autorisée", value: "950 kg" }, { label: "Fenêtre de mission", value: "14 jours" }],
      en: [{ label: "Available budget", value: "180 cr" }, { label: "Mass allowance", value: "950 kg" }, { label: "Mission window", value: "14 days" }],
    },
    tags: { fr: ["Communication", "Orbite lunaire"], en: ["Communications", "Lunar orbit"] },
  },
  {
    mission: {
      id: "mars-weather",
      name: "Mars Weather Scout",
      description: "Envoyez une sonde météo autonome étudier les tempêtes et les conditions de surface de la planète rouge.",
      objective: "Collecter et transmettre des mesures météorologiques martiennes pendant une saison de tempêtes.",
      difficulty: "medium",
      destination: "Mars",
      durationDays: 240,
      budgetLimit: 420,
      maxSpacecraftMass: 1450,
    },
    localizedMission: {
      fr: { name: "Mars Weather Scout", description: "Envoyez une sonde météo autonome étudier les tempêtes et les conditions de surface de la planète rouge.", objective: "Collecter et transmettre des mesures météorologiques martiennes pendant une saison de tempêtes.", destination: "Mars" },
      en: { name: "Mars Weather Scout", description: "Send an autonomous weather probe to study storms and surface conditions on the Red Planet.", objective: "Collect and transmit Martian weather readings through a storm season.", destination: "Mars" },
    },
    codename: "PLANETARY SCIENCE / 02",
    estimatedCost: 318,
    primaryObjectives: {
      fr: ["Collecter des relevés atmosphériques et de surface.", "Transmettre les données scientifiques vers la Terre."],
      en: ["Collect atmospheric and surface readings.", "Transmit scientific data back to Earth."],
    },
    secondaryObjectives: {
      fr: ["Surveiller l'évolution d'une tempête de poussière.", "Maintenir les instruments actifs pendant 240 jours."],
      en: ["Track the evolution of a dust storm.", "Keep instruments active for 240 days."],
    },
    constraints: {
      fr: ["Masse maximale du vaisseau : 1 450 kg", "Budget maximal : 420 crédits", "Autonomie requise : 240 jours"],
      en: ["Maximum spacecraft mass: 1,450 kg", "Maximum budget: 420 credits", "Required endurance: 240 days"],
    },
    resources: {
      fr: [{ label: "Budget disponible", value: "420 cr" }, { label: "Masse autorisée", value: "1 450 kg" }, { label: "Autonomie", value: "240 jours" }],
      en: [{ label: "Available budget", value: "420 cr" }, { label: "Mass allowance", value: "1,450 kg" }, { label: "Endurance", value: "240 days" }],
    },
    tags: { fr: ["Science planétaire", "Atmosphère"], en: ["Planetary science", "Atmosphere"] },
  },
  {
    mission: {
      id: "europa-survey",
      name: "Europa Deep Survey",
      description: "Étudiez la surface glacée d'Europe et recherchez les indices qui aideront à préparer une future exploration robotique.",
      objective: "Cartographier une zone d'Europe et transmettre des observations scientifiques exploitables.",
      difficulty: "hard",
      destination: "Europe, système jovien",
      durationDays: 900,
      budgetLimit: 760,
      maxSpacecraftMass: 2200,
    },
    localizedMission: {
      fr: { name: "Europa Deep Survey", description: "Étudiez la surface glacée d'Europe et recherchez les indices qui aideront à préparer une future exploration robotique.", objective: "Cartographier une zone d'Europe et transmettre des observations scientifiques exploitables.", destination: "Europe, système jovien" },
      en: { name: "Europa Deep Survey", description: "Study Europa's icy surface and search for clues that can prepare a future robotic exploration.", objective: "Map a region of Europa and transmit useful scientific observations.", destination: "Europa, Jovian system" },
    },
    codename: "DEEP SPACE / 03",
    estimatedCost: 592,
    primaryObjectives: {
      fr: ["Cartographier une région de la surface glacée.", "Transmettre les observations malgré la distance."],
      en: ["Map a region of the icy surface.", "Return observations across the long distance."],
    },
    secondaryObjectives: {
      fr: ["Repérer des structures de glace récentes.", "Conserver une réserve d'énergie pour la fin de mission."],
      en: ["Identify recent ice formations.", "Preserve an energy reserve for the end of the mission."],
    },
    constraints: {
      fr: ["Masse maximale du vaisseau : 2 200 kg", "Budget maximal : 760 crédits", "Durée de mission : 900 jours"],
      en: ["Maximum spacecraft mass: 2,200 kg", "Maximum budget: 760 credits", "Mission duration: 900 days"],
    },
    resources: {
      fr: [{ label: "Budget disponible", value: "760 cr" }, { label: "Masse autorisée", value: "2 200 kg" }, { label: "Durée de mission", value: "900 jours" }],
      en: [{ label: "Available budget", value: "760 cr" }, { label: "Mass allowance", value: "2,200 kg" }, { label: "Mission duration", value: "900 days" }],
    },
    tags: { fr: ["Exploration lointaine", "Glace"], en: ["Deep space", "Ice survey"] },
  },
];

export function getMission(id: string | undefined): MissionBriefing | undefined {
  return missions.find(({ mission }) => mission.id === id);
}
