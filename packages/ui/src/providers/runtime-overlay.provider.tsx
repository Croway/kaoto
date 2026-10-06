import { SharedValueConsumer } from '@kie-tools-core/envelope-bus/dist/api';
import { createContext, FunctionComponent, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { SendTestMessageModal } from '../components/Visualization/Canvas/StepToolbar/SendTestMessageModal';
import { RuntimeOverlay, RuntimeTestMessage } from '../models/runtime-overlay';

const EMPTY: RuntimeOverlay = { routes: {} };

export interface RuntimeOverlayContextValue {
  /** The runtime data of a running app to show on the canvas (none by default). */
  overlay: RuntimeOverlay;
  /** Sends a test message to a route of the running app, when the host can. */
  sendTestMessage?: (routeId: string, message?: RuntimeTestMessage) => Promise<void>;
  /** Opens the dialog to write a test message to a route (kept here: the node toolbar comes and goes with the mouse). */
  openSendTestMessage?: (routeId: string) => void;
}

export const RuntimeOverlayContext = createContext<RuntimeOverlayContextValue>({ overlay: EMPTY });

/** Provides the runtime data the host pushes through a shared value, when it pushes any. */
export const RuntimeOverlayProvider: FunctionComponent<
  PropsWithChildren<{
    consumer?: SharedValueConsumer<RuntimeOverlay>;
    sendTestMessage?: (routeId: string, message?: RuntimeTestMessage) => Promise<void>;
  }>
> = ({ consumer, sendTestMessage, children }) => {
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

  // the route a test message is being written for
  const [sendingTo, setSendingTo] = useState<string>();
  const openSendTestMessage = useCallback((routeId: string) => {
    setSendingTo(routeId);
  }, []);

  const value = useMemo(
    () => ({ overlay, sendTestMessage, openSendTestMessage: sendTestMessage ? openSendTestMessage : undefined }),
    [overlay, sendTestMessage, openSendTestMessage],
  );
  return (
    <RuntimeOverlayContext.Provider value={value}>
      {children}
      {sendingTo && sendTestMessage && (
        <SendTestMessageModal
          routeId={sendingTo}
          onSend={(message) => sendTestMessage(sendingTo, message)}
          onClose={() => {
            setSendingTo(undefined);
          }}
        />
      )}
    </RuntimeOverlayContext.Provider>
  );
};
