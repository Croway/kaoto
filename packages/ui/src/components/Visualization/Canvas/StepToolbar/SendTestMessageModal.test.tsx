import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SendTestMessageModal } from './SendTestMessageModal';

describe('SendTestMessageModal', () => {
  it('sends the body and the named headers, and remembers them for the route', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { unmount } = render(<SendTestMessageModal routeId="orders" onSend={onSend} onClose={onClose} />);

    fireEvent.change(screen.getByTestId('test-message-body'), { target: { value: '{"id":1}' } });
    fireEvent.click(screen.getByText('Add header'));
    fireEvent.change(screen.getByLabelText('Name of header 1'), { target: { value: 'fail' } });
    fireEvent.change(screen.getByLabelText('Value of header 1'), { target: { value: 'true' } });
    // a row without a name is not sent
    fireEvent.click(screen.getByText('Add header'));
    fireEvent.click(screen.getByTestId('test-message-send'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(onSend).toHaveBeenCalledWith({ body: '{"id":1}', headers: { fail: 'true' } });
    unmount();

    render(<SendTestMessageModal routeId="orders" onSend={onSend} onClose={onClose} />);
    expect(screen.getByTestId('test-message-body')).toHaveValue('{"id":1}');
    expect(screen.getByLabelText('Value of header 1')).toHaveValue('true');
  });

  it('formats a JSON body, and says when it is not JSON', () => {
    render(<SendTestMessageModal routeId="shipping" onSend={vi.fn()} onClose={vi.fn()} />);
    const body = screen.getByTestId('test-message-body');

    fireEvent.change(body, { target: { value: '{"a":1,"b":[1,2]}' } });
    fireEvent.click(screen.getByText('Format JSON'));
    expect(body).toHaveValue('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');

    fireEvent.change(body, { target: { value: '{not json' } });
    fireEvent.click(screen.getByText('Format JSON'));
    expect(screen.getByText(/Not valid JSON/)).toBeInTheDocument();
  });
});
