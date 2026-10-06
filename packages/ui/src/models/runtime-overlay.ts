/** Counters of a route, or of a step of a route. */
export interface RuntimeOverlayStatistics {
  total: number;
  failed: number;
}

/** The runtime state of a route of a running app, shown on the canvas. */
export interface RuntimeOverlayRoute extends RuntimeOverlayStatistics {
  state: string;
  /** step id -> its counters */
  steps: Record<string, RuntimeOverlayStatistics>;
}

/** The latest message a step processed, from the trace of the running app. */
export interface RuntimeOverlayMessage {
  /** epoch millis */
  timestamp?: number;
  exchangeId?: string;
  /** millis the step took */
  elapsed?: number;
  failed?: boolean;
  exception?: string;
  bodyType?: string;
  /** the body, shortened when large */
  body?: string;
  headers?: Record<string, string>;
  endpointUri?: string;
  /** source location, e.g. demo.camel.yaml:26 */
  location?: string;
  threadName?: string;
}

/** The steps one message went through, across routes: per route, step id -> its position on the path. */
export interface RuntimeOverlayPath {
  /** what the message was, e.g. the route it was sent to and its body */
  label?: string;
  steps: Record<string, Record<string, { order: number; failed: boolean }>>;
}

/**
 * Runtime data of a running Camel app, pushed by the host (e.g. from the Kaoto Kompanion) to show on the canvas. Routes
 * and steps are matched by id: steps without an explicit id in the source are not matched.
 */
export interface RuntimeOverlay {
  /** What the data is about (e.g. the app and its Camel version); empty when nothing is shown. */
  label?: string;
  /** route id -> its runtime state */
  routes: Record<string, RuntimeOverlayRoute>;
  /** route id -> step id -> the latest message the step processed (when the app is traced) */
  messages?: Record<string, Record<string, RuntimeOverlayMessage>>;
  /** the path of the latest message sent from the canvas */
  path?: RuntimeOverlayPath;
}

/** A test message to send to a route of the running app. */
export interface RuntimeTestMessage {
  body: string;
  headers: Record<string, string>;
}
