// Types énumérés (union types)
export type MissionDifficulty = "easy" | "medium" | "hard";
export type ComponentCategory = "structure" | "propulsion" | "power" | "communication" | "scientific_instrument" | "thermal_control" | "other";
export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type PlayerRole = "commander" | "engineer" | "scientist" | "communicator";
export type RoomStatus = "waiting" | "designing" | "simulating" | "finished";
export type ResourceType = "mass" | "energy" | "fuel" | "budget" | "data" | "communication" | "crew";

// ResourceState — tranché avec l'équipe
/**
 * État final des ressources après une simulation.
 * Chaque clé est optionnelle : toutes les missions ne suivent pas toutes les ressources.
 * Les unités seront précisées par le Membre 3 (moteur scientifique).
 */
export type ResourceState = Partial<Record<ResourceType, number>>;

// Interfaces du dictionnaire
/** Mission définie par le dictionnaire officiel. */
export interface Mission {
  id: string;
  name: string;
  description: string;
  objective: string;
  difficulty: MissionDifficulty;
  destination: string;
  durationDays: number;
  budgetLimit: number;
  maxSpacecraftMass: number;
}

/** Vaisseau conçu pour une mission. */
export interface Spacecraft {
  id: string;
  name: string;
  missionId: string;
  componentIds: string[];
  totalMass: number;
  totalCost: number;
  availableEnergy: number;
  fuel: number;
  communicationRangeKm: number;
}

/** Composant disponible dans le catalogue. */
export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  mass: number;
  cost: number;
  powerConsumption: number;
  powerProduction: number;
  fuelCapacity: number;
  reliability: number;
}

/** Événement imprévu pouvant affecter les ressources d'une mission. */
export interface MissionEvent {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: ImpactLevel;
  affectedResources: ResourceType[];
}

/** Résultat produit à la fin d'une simulation de mission. */
export interface SimulationResult {
  id: string;
  missionId: string;
  spacecraftId: string;
  success: boolean;
  score: number;
  durationDays: number;
  resourcesAtEnd: ResourceState;
  eventsEncountered: MissionEvent[];
  summary: string;
}

/** Analyse des causes, décisions et enseignements d'une mission. */
export interface MissionAutopsy {
  simulationResultId: string;
  mainCauses: string[];
  goodDecisions: string[];
  badDecisions: string[];
  lessonsLearned: string[];
}

/** Participant à une salle de jeu. */
export interface GamePlayer {
  id: string;
  displayName: string;
  role: PlayerRole;
  isReady: boolean;
}

/** Salle de jeu et participants associés. */
export interface GameRoom {
  id: string;
  name: string;
  missionId: string;
  hostPlayerId: string;
  players: GamePlayer[];
  status: RoomStatus;
  createdAt: string;
}
