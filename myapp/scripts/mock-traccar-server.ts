// Local mock Traccar WebSocket server for development and testing. Emits the
// same universal JSON frames as a real Traccar /api/socket endpoint so the
// client service can be exercised end-to-end without a live Traccar install.
//
//   npm run mock-traccar                      # ws://localhost:8082
//   PORT=8090 npm run mock-traccar            # different port
//   DROP_SECONDS=8,20 npm run mock-traccar    # force-close at 8s and 20s (reconnect test)
//
// The server accepts any token; it only checks that one is present.

import { WebSocketServer, WebSocket } from "ws";

type MockBus = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  speedKnots: number;
  course: number;
};

var DEFAULT_PORT = 8082;
var TICK_MS = 2000;

// Asia Pacific University, Kuala Lumpur area — plausible bus stops.
var SEED = {
  lat: 2.9953,
  lon: 101.7046
};

function seedBuses(): MockBus[] {
  return [
    { id: 101, name: "Bus A", lat: SEED.lat, lon: SEED.lon, speedKnots: 13.5, course: 90 },
    { id: 102, name: "Bus B", lat: SEED.lat + 0.002, lon: SEED.lon - 0.002, speedKnots: 9.7, course: 160 },
    { id: 103, name: "Bus C", lat: SEED.lat - 0.001, lon: SEED.lon + 0.001, speedKnots: 18.0, course: 20 }
  ];
}

var METERS_PER_DEG_LAT = 111320;
var KNOTS_TO_M_S = 0.514444;
var PI = Math.PI;

// Move a bus along its current course, then ease the course toward a slow
// rotation so the buses follow a loop rather than flying off the map.
function stepBus(bus: MockBus, dtSeconds: number): void {
  var rad = (bus.course * PI) / 180;
  var distanceMeters = bus.speedKnots * KNOTS_TO_M_S * dtSeconds;
  var dLat = (distanceMeters * Math.cos(rad)) / METERS_PER_DEG_LAT;
  var dLon =
    (distanceMeters * Math.sin(rad)) /
    (METERS_PER_DEG_LAT * Math.cos((bus.lat * PI) / 180));
  bus.lat = bus.lat + dLat;
  bus.lon = bus.lon + dLon;
  bus.course = (bus.course + 4 + Math.random() * 3) % 360;
}

function positionPayload(bus: MockBus): Record<string, unknown> {
  var now = new Date().toISOString();
  return {
    id: bus.id * 1000 + Date.now() % 1000,
    deviceId: bus.id,
    protocol: "mock",
    serverTime: now,
    deviceTime: now,
    fixTime: now,
    valid: true,
    latitude: Number(bus.lat.toFixed(6)),
    longitude: Number(bus.lon.toFixed(6)),
    altitude: 30,
    speed: Number(bus.speedKnots.toFixed(2)),
    course: Number(bus.course.toFixed(1)),
    accuracy: 5
  };
}

function devicePayload(bus: MockBus): Record<string, unknown> {
  return {
    id: bus.id,
    name: bus.name,
    uniqueId: "MOCK-" + bus.id,
    status: "online",
    lastUpdate: new Date().toISOString()
  };
}

var port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
var dropSeconds = (process.env.DROP_SECONDS || "")
  .split(",")
  .map(function(s) {
    return parseInt(s.trim(), 10);
  })
  .filter(function(n) {
    return !isNaN(n) && n > 0;
  });

var buses = seedBuses();
var clientId = 0;

var server = new WebSocketServer({ port: port, host: "127.0.0.1" });

server.on("listening", function() {
  console.log(
    "[mock-traccar] listening on ws://localhost:" +
      port +
      "/api/socket (tick " +
      TICK_MS +
      "ms)"
  );
  if (dropSeconds.length > 0) {
    console.log("[mock-traccar] scheduled drops at seconds: " + dropSeconds.join(", "));
  }
});

server.on("connection", function(ws: WebSocket, req) {
  clientId = clientId + 1;
  var id = clientId;
  var url = req.url || "";
  var hasToken = /[?&]token=/.test(url);
  console.log(
    "[mock-traccar] client " + id + " connected (token " + (hasToken ? "present" : "MISSING") + ")"
  );

  ws.send(
    JSON.stringify({
      devices: buses.map(devicePayload),
      positions: buses.map(positionPayload),
      events: []
    })
  );

  var ticker = setInterval(function() {
    for (var i = 0; i < buses.length; i++) {
      stepBus(buses[i], TICK_MS / 1000);
    }
    ws.send(
      JSON.stringify({
        positions: buses.map(positionPayload)
      })
    );
  }, TICK_MS);

  for (var d = 0; d < dropSeconds.length; d++) {
    setTimeout(function(second) {
      console.log(
        "[mock-traccar] client " + id + " force-closing at " + second + "s"
      );
      try {
        ws.close(4001, "mock drop");
      } catch (_err) {
      }
    }, dropSeconds[d] * 1000);
  }

  ws.on("close", function() {
    clearInterval(ticker);
    console.log("[mock-traccar] client " + id + " disconnected");
  });

  ws.on("error", function() {
    clearInterval(ticker);
  });
});
