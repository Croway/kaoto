import { SharedValueConsumer } from '@kie-tools-core/envelope-bus/dist/api';
import { createContext, FunctionComponent, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { SendTestMessageModal } from '../components/Visualization/Canvas/StepToolbar/SendTestMessageModal';
import { RuntimeOverlay, RuntimeTestMessage, RuntimeTestReply } from '../models/runtime-overlay';

const EMPTY: RuntimeOverlay = { routes: {} };

export interface RuntimeOverlayContextValue {
  /** The runtime data of a running app to show on the canvas (none by default). */
  overlay: RuntimeOverlay;
  /** Sends a test message to a route of the running app, when the host can. */
  sendTestMessage?: (routeId: string, message?: RuntimeTestMessage) => Promise<RuntimeTestReply | void>;
  /**
   * Opens the dialog to write a test message to a route, or to an endpoint of it (kept here: the node toolbar comes and
   * goes with the mouse).
   */
  openSendTestMessage?: (routeId: string, endpoint?: string) => void;
}

export const RuntimeOverlayContext = createContext<RuntimeOverlayContextValue>({ overlay: EMPTY });

/** Provides the runtime data the host pushes through a shared value, when it pushes any. */
export const RuntimeOverlayProvider: FunctionComponent<
  PropsWithChildren<{
    consumer?: SharedValueConsumer<RuntimeOverlay>;
    sendTestMessage?: (routeId: string, message?: RuntimeTestMessage) => Promise<RuntimeTestReply | void>;
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

  // the route (and endpoint) a test message is being written for
  const [sendingTo, setSendingTo] = useState<{ routeId: string; endpoint?: string }>();
  const openSendTestMessage = useCallback((routeId: string, endpoint?: string) => {
    setSendingTo({ routeId, endpoint });
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
          routeId={sendingTo.routeId}
          endpoint={sendingTo.endpoint}
          onSend={(message) => sendTestMessage(sendingTo.routeId, message)}
          onClose={() => {
            setSendingTo(undefined);
          }}
        />
      )}
    </RuntimeOverlayContext.Provider>
  );
};
