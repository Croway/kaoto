import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { FunctionComponent, useState } from 'react';

import { RuntimeTestMessage, RuntimeTestReply } from '../../../../models/runtime-overlay';

interface HeaderRow {
  key: string;
  value: string;
}

/** What was last sent to each route or endpoint, to send it again (kept while the editor lives). */
const lastSent = new Map<string, { body: string; headers: HeaderRow[]; exchangePattern?: 'InOnly' | 'InOut' }>();

interface SendTestMessageModalProps {
  routeId: string;
  /** an endpoint of the route to send to (e.g. the one of a `to` step), instead of the route */
  endpoint?: string;
  onSend: (message: RuntimeTestMessage) => Promise<RuntimeTestReply | void>;
  onClose: () => void;
}

/**
 * A test message to the endpoint a running route starts from, or to another endpoint of the route: its body (e.g. a
 * large JSON) and headers. A message to an endpoint keeps the dialog open with the outcome, and the reply with InOut.
 */
export const SendTestMessageModal: FunctionComponent<SendTestMessageModalProps> = ({
  routeId,
  endpoint,
  onSend,
  onClose,
}) => {
  const previous = lastSent.get(endpoint ?? routeId);
  const [body, setBody] = useState(previous?.body ?? '');
  const [headers, setHeaders] = useState<HeaderRow[]>(previous?.headers ?? []);
  const [exchangePattern, setExchangePattern] = useState<'InOnly' | 'InOut'>(previous?.exchangePattern ?? 'InOnly');
  const [jsonError, setJsonError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<RuntimeTestReply>();

  const formatJson = () => {
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2));
      setJsonError(undefined);
    } catch (error) {
      setJsonError(`Not valid JSON: ${(error as Error).message}`);
    }
  };

  const setHeader = (index: number, row: HeaderRow) => {
    setHeaders((all) => all.map((existing, i) => (i === index ? row : existing)));
  };

  const send = async () => {
    setSending(true);
    lastSent.set(endpoint ?? routeId, { body, headers, exchangePattern });
    const named: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) {
        named[key.trim()] = value;
      }
    }
    setReply(undefined);
    try {
      if (endpoint) {
        const outcome = await onSend({ body, headers: named, endpoint, exchangePattern });
        setReply(outcome ?? { status: 'pending', detail: 'Sent, no outcome reported.' });
      } else {
        await onSend({ body, headers: named });
        onClose();
      }
    } catch (error) {
      setReply({ status: 'failed', detail: (error as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen variant={ModalVariant.medium} onClose={onClose} ouiaId="SendTestMessageModal">
      <ModalHeader
        title={endpoint ? 'Send a test message to this endpoint' : `Send a test message to ${routeId}`}
        description={endpoint ? undefined : 'It goes to the endpoint the route starts from, in the running app.'}
      />
      <ModalBody>
        {endpoint && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title={
              <>
                Sends a real message to <code style={{ overflowWrap: 'anywhere' }}>{endpoint}</code> using the
                configuration of the running app.
              </>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <FormGroup label="Body" fieldId="test-message-body">
            <TextArea
              id="test-message-body"
              data-testid="test-message-body"
              value={body}
              onChange={(_event, value) => {
                setBody(value);
                setJsonError(undefined);
              }}
              rows={12}
              resizeOrientation="vertical"
              style={{ fontFamily: 'var(--pf-t--global--font--family--mono, monospace)', fontSize: 13 }}
              aria-label="Body of the test message"
            />
            <FormHelperText>
              <HelperText>
                {jsonError ? (
                  <HelperTextItem variant="error">{jsonError}</HelperTextItem>
                ) : (
                  <HelperTextItem>Any text: JSON, XML, plain text.</HelperTextItem>
                )}
              </HelperText>
            </FormHelperText>
            <ActionGroup style={{ marginTop: 0 }}>
              <Button variant="link" isInline onClick={formatJson} isDisabled={!body.trim()}>
                Format JSON
              </Button>
            </ActionGroup>
          </FormGroup>

          <FormGroup label="Headers" fieldId="test-message-headers" role="group">
            {headers.map((row, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}>
                <TextInput
                  id={`test-message-header-key-${index}`}
                  aria-label={`Name of header ${index + 1}`}
                  placeholder="Name"
                  value={row.key}
                  onChange={(_event, key) => {
                    setHeader(index, { ...row, key });
                  }}
                />
                <TextInput
                  id={`test-message-header-value-${index}`}
                  aria-label={`Value of header ${index + 1}`}
                  placeholder="Value"
                  value={row.value}
                  onChange={(_event, value) => {
                    setHeader(index, { ...row, value });
                  }}
                />
                <Button
                  variant="plain"
                  aria-label={`Remove header ${index + 1}`}
                  icon={<TrashIcon />}
                  onClick={() => {
                    setHeaders((all) => all.filter((_, i) => i !== index));
                  }}
                />
              </div>
            ))}
            <div>
              <Button
                variant="link"
                isInline
                icon={<PlusCircleIcon />}
                onClick={() => {
                  setHeaders((all) => [...all, { key: '', value: '' }]);
                }}
              >
                Add header
              </Button>
            </div>
          </FormGroup>

          {endpoint && (
            <FormGroup label="Exchange pattern" fieldId="test-message-pattern" role="radiogroup" isInline>
              <Radio
                id="test-message-pattern-inonly"
                name="test-message-pattern"
                label="InOnly (fire and forget)"
                isChecked={exchangePattern === 'InOnly'}
                onChange={() => {
                  setExchangePattern('InOnly');
                }}
              />
              <Radio
                id="test-message-pattern-inout"
                name="test-message-pattern"
                label="InOut (wait for the reply)"
                isChecked={exchangePattern === 'InOut'}
                onChange={() => {
                  setExchangePattern('InOut');
                }}
              />
            </FormGroup>
          )}
        </Form>
        {reply && <SendOutcome reply={reply} />}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={send}
          isLoading={sending}
          isDisabled={sending}
          data-testid="test-message-send"
        >
          Send
        </Button>
        <Button variant="link" onClick={onClose}>
          {reply ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const pre = {
  margin: 0,
  maxHeight: 200,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 12,
  padding: 8,
  borderRadius: 4,
  background: 'var(--pf-t--global--background--color--secondary--default, #f2f2f2)',
} as const;

/** How sending to an endpoint went, with the reply of an InOut exchange. */
const SendOutcome: FunctionComponent<{ reply: RuntimeTestReply }> = ({ reply }) => {
  const headers = Object.entries(reply.headers ?? {});
  const hasReply = reply.body !== undefined || headers.length > 0;
  return (
    <div data-testid="test-message-outcome" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Alert
        variant={reply.status === 'failed' ? 'danger' : reply.status === 'acked' ? 'success' : 'info'}
        isInline
        title={reply.status === 'failed' ? 'Sending failed' : reply.status === 'acked' ? 'Sent' : 'Sent, no answer yet'}
      >
        {reply.detail}
        {reply.exchangeId && (
          <div>
            Exchange <code>{reply.exchangeId}</code>
          </div>
        )}
      </Alert>
      {hasReply && (
        <>
          <strong>Reply headers ({headers.length})</strong>
          {headers.length > 0 && <pre style={pre}>{headers.map(([key, value]) => `${key}: ${value}`).join('\n')}</pre>}
          <strong>Reply body{reply.bodyType ? ` (${reply.bodyType})` : ''}</strong>
          {reply.body !== undefined ? <pre style={pre}>{reply.body}</pre> : <span>empty</span>}
        </>
      )}
    </div>
  );
};
