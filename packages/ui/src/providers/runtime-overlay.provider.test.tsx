import { fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';

import { RuntimeOverlayContext, RuntimeOverlayProvider } from './runtime-overlay.provider';

const OpenButton = () => {
  const { openSendTestMessage } = useContext(RuntimeOverlayContext);
  return <button onClick={() => openSendTestMessage?.('orders')}>open</button>;
};

describe('RuntimeOverlayProvider', () => {
  it('keeps the test message dialog open when what opened it goes away', () => {
    const sendTestMessage = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <RuntimeOverlayProvider sendTestMessage={sendTestMessage}>
        <OpenButton />
      </RuntimeOverlayProvider>,
    );
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByText('Send a test message to orders')).toBeInTheDocument();

    // the node toolbar is removed when the mouse moves to the dialog
    rerender(<RuntimeOverlayProvider sendTestMessage={sendTestMessage} />);
    expect(screen.getByText('Send a test message to orders')).toBeInTheDocument();
  });

  it('offers no dialog when the host cannot send', () => {
    let value: unknown;
    const Probe = () => {
      value = useContext(RuntimeOverlayContext).openSendTestMessage;
      return null;
    };
    render(
      <RuntimeOverlayProvider>
        <Probe />
      </RuntimeOverlayProvider>,
    );
    expect(value).toBeUndefined();
  });
});
