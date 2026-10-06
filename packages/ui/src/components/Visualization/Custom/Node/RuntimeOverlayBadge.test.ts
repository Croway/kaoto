import { IVisualizationNode } from '../../../../models';
import { RuntimeOverlay } from '../../../../models/runtime-overlay';
import { pathEdgeOf, pathStepOf } from './RuntimeOverlayBadge';

const node = (routeId: string, stepId?: string) =>
  ({ getId: () => routeId, data: { definition: stepId ? { id: stepId } : {} } }) as unknown as IVisualizationNode;

const overlay: RuntimeOverlay = {
  routes: {},
  path: {
    label: 'orders: order-1',
    steps: {
      orders: {
        'from-orders': { order: 1, failed: false },
        'log-order': { order: 2, failed: false },
        boom: { order: 3, failed: true },
      },
    },
  },
};

describe('runtime overlay path', () => {
  it('finds the steps of the path', () => {
    expect(pathStepOf(overlay, node('orders', 'log-order'))).toEqual({ order: 2, failed: false });
    expect(pathStepOf(overlay, node('orders', 'reply'))).toBeUndefined();
    expect(pathStepOf(overlay, node('orders'))).toBeUndefined();
    expect(pathStepOf({ routes: {} }, node('orders', 'log-order'))).toBeUndefined();
  });

  it('highlights the edges the message went along, forward only', () => {
    expect(pathEdgeOf(overlay, node('orders', 'from-orders'), node('orders', 'log-order'))).toEqual({ failed: false });
    expect(pathEdgeOf(overlay, node('orders', 'log-order'), node('orders', 'boom'))).toEqual({ failed: true });
    // backwards, off the path, across routes
    expect(pathEdgeOf(overlay, node('orders', 'log-order'), node('orders', 'from-orders'))).toBeUndefined();
    expect(pathEdgeOf(overlay, node('orders', 'log-order'), node('orders', 'reply'))).toBeUndefined();
    expect(pathEdgeOf(overlay, node('orders', 'log-order'), node('shipping', 'boom'))).toBeUndefined();
    expect(pathEdgeOf({ routes: {} }, node('orders', 'from-orders'), node('orders', 'log-order'))).toBeUndefined();
  });
});
