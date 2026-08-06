"use client";

import React from "react";
import { getTraccarToken, getTraccarWsUrl } from "./config";
import { TraccarSocket } from "./traccar-socket";
import type {
  BusPosition,
  ConnectionStatus,
  TraccarSocketMessage
} from "./types";

export type UseTraccarOptions = {
  enabled?: boolean;
  url?: string;
  token?: string;
  onPosition?: (position: BusPosition) => void;
};

export type TraccarState = {
  status: ConnectionStatus;
  positions: Record<number, BusPosition>;
  lastMessage: TraccarSocketMessage | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
};

// React hook that owns a TraccarSocket for the lifetime of the component.
// Connects on mount, disconnects on unmount, and reconnects automatically via
// the service whenever the connection drops.
export function useTraccarSocket(options?: UseTraccarOptions): TraccarState {
  var enabled = options?.enabled !== false;
  var url = options?.url || getTraccarWsUrl();
  var token = options?.token !== undefined ? options.token : getTraccarToken();

  var [status, setStatus] = React.useState<ConnectionStatus>("idle");
  var [positions, setPositions] = React.useState<Record<number, BusPosition>>({});
  var [lastMessage, setLastMessage] = React.useState<TraccarSocketMessage | null>(null);
  var [error, setError] = React.useState<string | null>(null);

  var socketRef = React.useRef<TraccarSocket | null>(null);
  var onPositionRef = React.useRef(options?.onPosition);

  React.useEffect(function() {
    onPositionRef.current = options?.onPosition;
  });

  React.useEffect(function() {
    if (!enabled) {
      return;
    }

    var socket = new TraccarSocket({
      url: url,
      token: token,
      onStatus: function(nextStatus) {
        setStatus(nextStatus);
      },
      onMessage: function(message, busPositions) {
        setLastMessage(message);
        if (busPositions.length === 0) {
          return;
        }
        setPositions(function(prev) {
          var next = Object.assign({}, prev);
          for (var i = 0; i < busPositions.length; i++) {
            var p = busPositions[i];
            next[p.deviceId] = p;
          }
          return next;
        });
        for (var j = 0; j < busPositions.length; j++) {
          if (onPositionRef.current) {
            onPositionRef.current(busPositions[j]);
          }
        }
      },
      onLog: function(level, messageText) {
        if (level === "error") {
          setError(messageText);
        }
      }
    });

    socketRef.current = socket;
    socket.connect();

    return function() {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, url, token]);

  function connect(): void {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }

  function disconnect(): void {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }

  return {
    status: status,
    positions: positions,
    lastMessage: lastMessage,
    error: error,
    connect: connect,
    disconnect: disconnect
  };
}
