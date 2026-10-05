import { SharedValueConsumer } from '@kie-tools-core/envelope-bus/dist/api';
import { createContext, FunctionComponent, PropsWithChildren, useEffect, useState } from 'react';

import { RuntimeOverlay } from '../models/runtime-overlay';

const EMPTY: RuntimeOverlay = { routes: {} };

/** The runtime data of a running app to show on the canvas (none by default). */
export const RuntimeOverlayContext = createContext<RuntimeOverlay>(EMPTY);

/** Provides the runtime data the host pushes through a shared value, when it pushes any. */
export const RuntimeOverlayProvider: FunctionComponent<
  PropsWithChildren<{ consumer?: SharedValueConsumer<RuntimeOverlay> }>
> = ({ consumer, children }) => {
  const [overlay, setOverlay] = useState<RuntimeOverlay>(EMPTY);

  useEffect(() => {
    if (!consumer) {
      return;
    }
    const subscription = consumer.subscribe((value) => {
      setOverlay(value ?? EMPTY);
    });
    return () => {
      consumer.unsubscribe(subscription);
    };
  }, [consumer]);

  return <RuntimeOverlayContext.Provider value={overlay}>{children}</RuntimeOverlayContext.Provider>;
};
