import { FunctionComponent, useContext } from 'react';

import { IVisualizationNode } from '../../../../models';
import { RuntimeOverlayContext } from '../../../../providers/runtime-overlay.provider';

/**
 * The runtime counters of a step, from the runtime data the host pushes: the route state and counters on the first step
 * of a route, the step counters elsewhere. Nothing when there is no data for the step.
 */
/** Whether the node is the endpoint a route starts from. */
export const isRouteFrom = (vizNode: IVisualizationNode): boolean => {
  const path = vizNode.data.path ?? '';
  return path === 'from' || path.endsWith('.from');
};

export const RuntimeOverlayBadge: FunctionComponent<{ vizNode: IVisualizationNode }> = ({ vizNode }) => {
  const { overlay } = useContext(RuntimeOverlayContext);
  if (Object.keys(overlay.routes).length === 0) {
    // nothing shown: the usual case
    return null;
  }
  const route = overlay.routes[vizNode.getId() ?? ''];
  if (!route) {
    return null;
  }
  const isFrom = isRouteFrom(vizNode);
  const stepId = (vizNode.data.definition as { id?: string } | undefined)?.id;
  const statistics = isFrom ? route : stepId ? route.steps[stepId] : undefined;
  if (!statistics) {
    return null;
  }
  const text = `${isFrom ? `${route.state} · ` : ''}${statistics.total}${statistics.failed ? ` / ${statistics.failed}✗` : ''}`;
  return (
    <span
      data-testid="runtime-overlay-badge"
      title={`${overlay.label ?? 'runtime'}: ${statistics.total} exchanges, ${statistics.failed} failed`}
      style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0 6px',
        borderRadius: 8,
        fontSize: 11,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        color: '#fff',
        background: statistics.failed ? '#c9190b' : isFrom && route.state !== 'Started' ? '#6a6e73' : '#3e8635',
      }}
    >
      {text}
    </span>
  );
};
