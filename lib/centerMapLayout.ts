export type CenterMapSystem = {
  key:
    | "green-house"
    | "open-wetland"
    | "atu-a"
    | "atu-b"
    | "dose"
    | "hoot"
    | "m-bio"
    | "delta"
    | "cl";
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
};

export const CENTER_MAP_SYSTEMS: CenterMapSystem[] = [
  { key: "green-house", label: "Green House", left: 2, top: 4, width: 9, height: 26 },
  { key: "open-wetland", label: "Open Wetland", left: 13, top: 4, width: 9, height: 26 },
  { key: "atu-a", label: "ATU-A", left: 31, top: 4, width: 9, height: 26 },
  { key: "atu-b", label: "ATU-B", left: 43, top: 4, width: 9, height: 26 },
  { key: "dose", label: "DOSE", left: 37, top: 40, width: 9, height: 26 },
  { key: "hoot", label: "HOOT", left: 61, top: 28, width: 9, height: 26 },
  { key: "m-bio", label: "M-BIO", left: 74, top: 28, width: 9, height: 26 },
  { key: "delta", label: "DELTA", left: 61.5, top: 63, width: 9, height: 26 },
  { key: "cl", label: "CL", left: 74.5, top: 63, width: 9, height: 26 },
];

export const CENTER_MAP_KEYS = CENTER_MAP_SYSTEMS.map((s) => s.key);

export function isCenterMapKey(value: string): value is CenterMapSystem["key"] {
  return CENTER_MAP_KEYS.includes(value as CenterMapSystem["key"]);
}
