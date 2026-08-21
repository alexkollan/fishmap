export type Mode = "shore" | "boat" | "spearfishing";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ActiveLocation extends Coordinates {
  name: string;
}

export interface FactorScore {
  key: string;
  score: number;
  weight: number;
  note: string;
}

export interface ScoreResult {
  score: number;
  vetoes: string[];
  factors: FactorScore[];
}

export interface WeightProfile {
  mode: Mode;
  weights: Record<string, number>;
}
