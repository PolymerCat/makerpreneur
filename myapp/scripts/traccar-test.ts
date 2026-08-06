// Standalone Traccar WebSocket verification script. Run with tsx:
//
//   TRACCAR_TOKEN=your_token npm run test-traccar
//   TRACCAR_WS_URL=ws://host:8082/api/socket TRACCAR_TOKEN=... npm run test-traccar
//
// Optional --maxSeconds=N flag auto-exits after N seconds (used by automated
// checks). Without it the script runs until Ctrl+C.

import { TraccarSocket } from "../app/study/_lib/traccar/traccar-socket";
import type { TraccarSocketMessage } from "../app/study/_lib/traccar/types";

var DEFAULT_WS_URL = "ws://localhost:8082/api/socket";

function parseMaxSeconds(args: string[]): number | null {
  for (var i = 0; i < args.length; i++) {
    var match = /^--maxSeconds=(\d+)$/.exec(args[i]);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

function timestamp(): string {
  return new Date().toISOString();
}

var url =
  process.env.TRACCAR_WS_URL ||
  process.env.NEXT_PUBLIC_TRACCAR_WS_URL ||
  DEFAULT_WS_URL;
var token = process.env.TRACCAR_TOKEN || process.env.NEXT_PUBLIC_TRACCAR_TOKEN || "";

var maxSeconds = parseMaxSeconds(process.argv.slice(2));

console.log("[" + timestamp() + "] Traccar test connecting to " + url);

var socket = new TraccarSocket({
  url: url,
  token: token,
  onStatus: function(status) {
    console.log("[" + timestamp() + "] status -> " + status);
  },
  onLog: function(level, message) {
    console.log("[" + timestamp() + "] [" + level + "] " + message);
  },
  onMessage: function(message: TraccarSocketMessage) {
    var devices = message.devices || [];
    for (var i = 0; i < devices.length; i++) {
      var device = devices[i];
      console.log(
        "[" + timestamp() + "] device " + device.id + " (" + device.name + ") status=" + device.status
      );
    }

    var positions = message.positions || [];
    for (var j = 0; j < positions.length; j++) {
      var pos = positions[j];
      console.log(
        "[" +
          timestamp() +
          "] position device=" +
          pos.deviceId +
          " lat=" +
          pos.latitude.toFixed(6) +
          " lon=" +
          pos.longitude.toFixed(6) +
          " speedKnots=" +
          pos.speed +
          " speedKph=" +
          (pos.speed ? Math.round(pos.speed * 1.852 * 100) / 100 : 0) +
          " course=" +
          pos.course +
          " fixTime=" +
          pos.fixTime
      );
    }

    var events = message.events || [];
    for (var k = 0; k < events.length; k++) {
      var event = events[k];
      console.log(
        "[" + timestamp() + "] event device=" + event.deviceId + " type=" + event.type
      );
    }
  }
});

socket.connect();

if (maxSeconds !== null) {
  setTimeout(function() {
    console.log(
      "[" + timestamp() + "] --maxSeconds reached, disconnecting"
    );
    socket.disconnect();
    process.exit(0);
  }, maxSeconds * 1000);
}

process.on("SIGINT", function() {
  console.log("[" + timestamp() + "] shutting down");
  socket.disconnect();
  process.exit(0);
});
