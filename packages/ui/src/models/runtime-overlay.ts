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

/**
 * Runtime data of a running Camel app, pushed by the host (e.g. from the Kaoto Kompanion) to show on the canvas. Routes
 * and steps are matched by id: steps without an explicit id in the source are not matched.
 */
export interface RuntimeOverlay {
  /** What the data is about (e.g. the app and its Camel version); empty when nothing is shown. */
  label?: string;
  /** route id -> its runtime state */
  routes: Record<string, RuntimeOverlayRoute>;
}
