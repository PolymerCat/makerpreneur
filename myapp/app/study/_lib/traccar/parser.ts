import type { TraccarPosition, TraccarSocketMessage, BusPosition } from "./types";

// Parse a raw WebSocket frame into a Traccar socket message. Returns null for
// empty or non-JSON frames (e.g. server pongs or keepalive noise).
export function parseTraccarMessage(raw: string): TraccarSocketMessage | null {
  if (!raw) {
    return null;
  }
  var text = raw.trim();
  if (text === "") {
    return null;
  }
  try {
    var parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as TraccarSocketMessage;
    }
  } catch (_err) {
    return null;
  }
  return null;
}

// Traccar reports speed in knots; convert to km/h for display.
const KNOTS_TO_KPH = 1.852;

export function toBusPosition(
  position: TraccarPosition,
  deviceName?: string
): BusPosition {
  var speedKnots = typeof position.speed === "number" ? position.speed : 0;
  return {
    deviceId: position.deviceId,
    deviceName: deviceName,
    latitude: position.latitude,
    longitude: position.longitude,
    speedKnots: speedKnots,
    speedKph: Math.round(speedKnots * KNOTS_TO_KPH * 100) / 100,
    course: position.course ?? 0,
    valid: position.valid !== false,
    fixTime: position.fixTime,
    address: position.address,
    accuracy: position.accuracy
  };
}

// Pull the location-relevant fields (lat, lon, speed, course) out of a
// Traccar socket message. Any position missing coordinates is skipped.
export function extractBusPositions(
  message: TraccarSocketMessage
): BusPosition[] {
  var result: BusPosition[] = [];
  var devices = message.devices || [];
  var positions = message.positions || [];
  var nameById: Record<number, string> = {};
  for (var i = 0; i < devices.length; i++) {
    nameById[devices[i].id] = devices[i].name;
  }
  for (var j = 0; j < positions.length; j++) {
    var pos = positions[j];
    if (
      typeof pos.latitude !== "number" ||
      typeof pos.longitude !== "number"
    ) {
      continue;
    }
    result.push(toBusPosition(pos, nameById[pos.deviceId]));
  }
  return result;
}
