import { extractBusPositions, parseTraccarMessage } from "./parser";
import type {
  BusPosition,
  ConnectionStatus,
  LogLevel,
  TraccarSocketMessage
} from "./types";

export type TraccarSocketOptions = {
  url: string;
  token?: string;
  onMessage?: (message: TraccarSocketMessage, positions: BusPosition[]) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onLog?: (level: LogLevel, message: string) => void;
  minReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  maxReconnectAttempts?: number;
};

var DEFAULT_MIN_RECONNECT_MS = 1000;
var DEFAULT_MAX_RECONNECT_MS = 30000;
var DEFAULT_MAX_RECONNECT_ATTEMPTS = Infinity;

// Append the user access token as a query parameter (supported by Traccar
// since 2024). The token never appears in log output.
function buildSocketUrl(url: string, token?: string): string {
  if (!token) {
    return url;
  }
  var separator = url.indexOf("?") === -1 ? "?" : "&";
  return url + separator + "token=" + encodeURIComponent(token);
}

function maskSocketUrl(url: string): string {
  return url.replace(/token=[^&]*/, "token=***");
}

// Dedicated WebSocket connection manager for the Traccar server. Owns a single
// socket, parses incoming JSON, surfaces parsed bus positions, and reconnects
// with exponential backoff on drops. Works in both the browser (DOM WebSocket)
// and Node 21+ (global WebSocket), so the same class drives the app hook and
// the standalone verification script.
export class TraccarSocket {
  private options: TraccarSocketOptions;
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = "idle";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  constructor(options: TraccarSocketOptions) {
    this.options = options;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  connect(): void {
    this.manuallyClosed = false;
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      var ws = this.socket;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch (_err) {
      }
      this.socket = null;
    }
    this.setStatus("closed");
  }

  private openSocket(): void {
    if (typeof WebSocket === "undefined") {
      this.log("error", "WebSocket is not available in this environment");
      this.setStatus("error");
      return;
    }

    var socketUrl = buildSocketUrl(this.options.url, this.options.token);
    var ws: WebSocket;
    try {
      ws = new WebSocket(socketUrl);
    } catch (err) {
      this.log("error", "Failed to create WebSocket: " + String(err));
      this.setStatus("error");
      return;
    }
    this.socket = ws;

    if (this.reconnectAttempt === 0) {
      this.setStatus("connecting");
    } else {
      this.setStatus("reconnecting");
      this.log(
        "info",
        "Reconnect attempt " +
          this.reconnectAttempt +
          " for " +
          maskSocketUrl(socketUrl)
      );
    }

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("open");
      this.log(
        "info",
        "Connected to Traccar WebSocket: " + maskSocketUrl(socketUrl)
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      var message = parseTraccarMessage(
        typeof event.data === "string" ? event.data : String(event.data)
      );
      if (!message) {
        return;
      }
      var positions = extractBusPositions(message);
      if (this.options.onMessage) {
        this.options.onMessage(message, positions);
      }
    };

    ws.onerror = () => {
      this.log(
        "warn",
        "Traccar WebSocket error on " + maskSocketUrl(socketUrl)
      );
    };

    ws.onclose = (event: CloseEvent) => {
      if (this.socket === ws) {
        this.socket = null;
      }
      this.scheduleReconnect(event);
    };
  }

  private scheduleReconnect(event: CloseEvent): void {
    if (this.manuallyClosed) {
      this.setStatus("closed");
      return;
    }

    var maxAttempts =
      this.options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    if (this.reconnectAttempt >= maxAttempts) {
      this.setStatus("error");
      this.log(
        "error",
        "Traccar WebSocket gave up after " +
          this.reconnectAttempt +
          " reconnect attempts (close code " +
          event.code +
          ")"
      );
      return;
    }

    this.reconnectAttempt = this.reconnectAttempt + 1;
    this.setStatus("reconnecting");

    var minDelay = this.options.minReconnectDelayMs ?? DEFAULT_MIN_RECONNECT_MS;
    var maxDelay = this.options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_MS;
    var exponent = this.reconnectAttempt - 1;
    var delay = Math.min(minDelay * Math.pow(2, exponent), maxDelay);

    this.log(
      "warn",
      "Traccar connection dropped (close code " +
        event.code +
        "), reconnecting in " +
        delay +
        "ms (attempt " +
        this.reconnectAttempt +
        ")"
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    if (this.options.onStatus) {
      this.options.onStatus(status);
    }
  }

  private log(level: LogLevel, message: string): void {
    if (this.options.onLog) {
      this.options.onLog(level, message);
    }
  }
}
