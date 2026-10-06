import { Popover } from '@patternfly/react-core';
import { CSSProperties, FunctionComponent, MouseEvent, useContext } from 'react';

import { IVisualizationNode } from '../../../../models';
import { RuntimeOverlayMessage } from '../../../../models/runtime-overlay';
import { RuntimeOverlayContext } from '../../../../providers/runtime-overlay.provider';

/** Whether the node is the endpoint a route starts from. */
export const isRouteFrom = (vizNode: IVisualizationNode): boolean => {
  const path = vizNode.data.path ?? '';
  return path === 'from' || path.endsWith('.from');
};

const PATH_COLOR = '#0066cc';
const FAILED_COLOR = '#c9190b';

const pill: CSSProperties = {
  position: 'absolute',
  padding: '0 6px',
  borderRadius: 8,
  fontSize: 11,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  color: '#fff',
};

// the node selects and drags on mouse down: the overlay controls keep their clicks
const keepClick = (event: MouseEvent) => {
  event.stopPropagation();
};

/**
 * The runtime data of a step, from what the host pushes: the route state and counters on the first step of a route,
 * the step counters elsewhere; when the step is on the path of the latest message sent from the canvas, an outline and
 * its position on the path; and a button with the latest message the step processed. Nothing without data for the step.
 */
export const RuntimeOverlayBadge: FunctionComponent<{ vizNode: IVisualizationNode }> = ({ vizNode }) => {
  const { overlay } = useContext(RuntimeOverlayContext);
  if (Object.keys(overlay.routes).length === 0) {
    // nothing shown: the usual case
    return null;
  }
  const routeId = vizNode.getId() ?? '';
  const route = overlay.routes[routeId];
  if (!route) {
    return null;
  }
  const isFrom = isRouteFrom(vizNode);
  const stepId = (vizNode.data.definition as { id?: string } | undefined)?.id;
  const statistics = isFrom ? route : stepId ? route.steps[stepId] : undefined;
  const onPath = stepId ? overlay.path?.steps[routeId]?.[stepId] : undefined;
  const message = stepId ? overlay.messages?.[routeId]?.[stepId] : undefined;

  return (
    <>
      {onPath && (
        <>
          <span
            data-testid="runtime-overlay-path"
            style={{
              position: 'absolute',
              inset: -6,
              border: `2px solid ${onPath.failed ? FAILED_COLOR : PATH_COLOR}`,
              borderRadius: 10,
              pointerEvents: 'none',
            }}
          />
          <span
            title={`Step ${onPath.order} of ${overlay.path?.label ?? 'the latest message'}`}
            style={{ ...pill, top: -10, left: -12, background: onPath.failed ? FAILED_COLOR : PATH_COLOR }}
          >
            {onPath.order}
          </span>
        </>
      )}
      {statistics && (
        <span
          data-testid="runtime-overlay-badge"
          title={`${overlay.label ?? 'runtime'}: ${statistics.total} exchanges, ${statistics.failed} failed`}
          style={{
            ...pill,
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: statistics.failed ? FAILED_COLOR : isFrom && route.state !== 'Started' ? '#6a6e73' : '#3e8635',
          }}
        >
          {`${isFrom ? `${route.state} · ` : ''}${statistics.total}${statistics.failed ? ` / ${statistics.failed}✗` : ''}`}
        </span>
      )}
      {message && (
        <Popover
          aria-label={`Latest message at ${stepId}`}
          headerContent={`Latest message at ${stepId}`}
          bodyContent={<RuntimeMessageDetails message={message} />}
          minWidth="360px"
          maxWidth="520px"
          position="right"
        >
          <button
            type="button"
            data-testid="runtime-overlay-message"
            title="Latest message of this step"
            aria-label={`Latest message at ${stepId}`}
            onMouseDown={keepClick}
            onClick={keepClick}
            style={{
              ...pill,
              bottom: -10,
              right: -12,
              border: 0,
              cursor: 'pointer',
              background: message.failed ? FAILED_COLOR : PATH_COLOR,
            }}
          >
            ✉
          </button>
        </Popover>
      )}
    </>
  );
};

const row: CSSProperties = { display: 'grid', gridTemplateColumns: '7em minmax(0, 1fr)', gap: 8, fontSize: 13 };
const pre: CSSProperties = {
  margin: 0,
  maxHeight: 180,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 12,
  padding: 8,
  borderRadius: 4,
  background: 'var(--pf-t--global--background--color--secondary--default, #f2f2f2)',
};

/** The latest message a step processed: what it carried and how the step went. */
const RuntimeMessageDetails: FunctionComponent<{ message: RuntimeOverlayMessage }> = ({ message }) => {
  const headers = Object.entries(message.headers ?? {});
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="runtime-message-details">
      {message.timestamp !== undefined && (
        <div style={row}>
          <strong>Time</strong>
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
      <div style={row}>
        <strong>Exchange</strong>
        <code style={{ overflowWrap: 'anywhere' }}>{message.exchangeId}</code>
      </div>
      {message.elapsed !== undefined && (
        <div style={row}>
          <strong>Took</strong>
          <span>{message.elapsed} ms</span>
        </div>
      )}
      {message.failed && (
        <div style={{ ...row, color: FAILED_COLOR }}>
          <strong>Failed</strong>
          <span>{message.exception ?? 'yes'}</span>
        </div>
      )}
      {message.location && (
        <div style={row}>
          <strong>Source</strong>
          <span>{message.location}</span>
        </div>
      )}
      {message.endpointUri && (
        <div style={row}>
          <strong>Endpoint</strong>
          <code style={{ overflowWrap: 'anywhere' }}>{message.endpointUri}</code>
        </div>
      )}
      {message.threadName && (
        <div style={row}>
          <strong>Thread</strong>
          <span style={{ overflowWrap: 'anywhere' }}>{message.threadName}</span>
        </div>
      )}
      <strong>Headers ({headers.length})</strong>
      {headers.length > 0 ? (
        <pre style={pre}>{headers.map(([key, value]) => `${key}: ${value}`).join('\n')}</pre>
      ) : (
        <span style={{ fontSize: 13 }}>none</span>
      )}
      <strong>Body{message.bodyType ? ` (${message.bodyType})` : ''}</strong>
      {message.body !== undefined ? <pre style={pre}>{message.body}</pre> : <span style={{ fontSize: 13 }}>empty</span>}
    </div>
  );
};
