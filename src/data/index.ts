import schoolsJson from './schools.json';
import zonesJson from './zones.json';
import fieldSourcesJson from './field-sources.json';

/** Map coordinates are meters east (x) and south (y) of SE 39th & Belmont-ish (45.52, -122.66). */
export type Point = [number, number];
export type Ring = Point[];
export type Level = 'K5' | 'K8' | 'MS' | 'ALT' | 'HS';

export interface SchoolData {
  id: string;
  name: string;
  level: Level;
  x: number;
  y: number;
  enrollment: number | null;
  history: Record<string, number | null>;
  /** PSU PRC medium forecast, keyed by the fall year (2026 = 2026-27). */
  forecast: Record<string, number | null>;
  forecast2035Low: number | null;
  forecast2035High: number | null;
  capacity: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  isUrm: boolean;
  /** 'planned_*' is scheduled by the 2025 bond; null is none. */
  seismicRetrofitStatus: 'targeted' | 'full' | 'planned_targeted' | 'planned_full' | null;
  retrofitRemaining: number | null;
  pctDirectCert: number | null;
  pctFrl: number | null;
  pctBipoc: number | null;
  isTitleI: boolean;
  dliLanguages: string | null;
  dliStudents: number | null;
  hasFocusOption: boolean;
  scenarioA: string | null;
  scenarioB: string | null;
}

export interface HighSchoolData {
  id: string;
  name: string;
  level: 'HS';
  x: number;
  y: number;
  enrollment: number | null;
}

export interface Zone {
  name: string;
  school: string;
  rings: Ring[];
}

export interface FieldSource {
  label: string;
  desc: string;
  source: string;
}

export const PPS_DATA_COMMIT: string = schoolsJson.ppsDataCommit;
export const SCHOOLS = schoolsJson.schools as SchoolData[];
export const HIGH_SCHOOLS = schoolsJson.highSchools as HighSchoolData[];
export const ZONES = zonesJson as unknown as Record<'elementary' | 'middle' | 'high', Zone[]>;
export const FIELD_SOURCES = fieldSourcesJson as Record<string, FieldSource>;
