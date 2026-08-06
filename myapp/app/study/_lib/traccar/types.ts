export type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status?: string;
  lastUpdate?: string;
  positionId?: number;
  groupId?: number;
  attributes?: Record<string, unknown>;
};

export type TraccarPosition = {
  id: number;
  deviceId: number;
  protocol?: string;
  serverTime?: string;
  deviceTime?: string;
  fixTime?: string;
  valid?: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  course?: number;
  address?: string;
  accuracy?: number;
  attributes?: Record<string, unknown>;
};

export type TraccarEvent = {
  id: number;
  deviceId?: number;
  type?: string;
  serverTime?: string;
  geofenceId?: number;
  positionId?: number;
  attributes?: Record<string, unknown>;
};

export type TraccarSocketMessage = {
  devices?: TraccarDevice[];
  positions?: TraccarPosition[];
  events?: TraccarEvent[];
};

export type BusPosition = {
  deviceId: number;
  deviceName?: string;
  latitude: number;
  longitude: number;
  speedKnots: number;
  speedKph: number;
  course: number;
  valid: boolean;
  fixTime?: string;
  address?: string;
  accuracy?: number;
};

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export type LogLevel = "info" | "warn" | "error";
