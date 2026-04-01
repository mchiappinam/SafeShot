export function getMonitorScaleFactor(displayId: string): number;

export interface MonitorInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export function getMonitorGeometry(): MonitorInfo[];

// Windows-only registry helpers (undefined on macOS/Linux)
export function readRegistryDword(
  hive: 'HKCU' | 'HKLM',
  subKey: string,
  valueName: string
): number | undefined;

export function writeRegistryDword(
  hive: 'HKCU' | 'HKLM',
  subKey: string,
  valueName: string,
  value: number
): boolean | undefined;
