import {
  ActionGroup,
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
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { FunctionComponent, useState } from 'react';

import { RuntimeTestMessage } from '../../../../models/runtime-overlay';

interface HeaderRow {
  key: string;
  value: string;
}

/** What was last sent to each route, to send it again (kept while the editor lives). */
const lastSent = new Map<string, { body: string; headers: HeaderRow[] }>();

interface SendTestMessageModalProps {
  routeId: string;
  onSend: (message: RuntimeTestMessage) => Promise<void>;
  onClose: () => void;
}

/** A test message to the endpoint a running route starts from: its body (e.g. a large JSON) and headers. */
export const SendTestMessageModal: FunctionComponent<SendTestMessageModalProps> = ({ routeId, onSend, onClose }) => {
  const previous = lastSent.get(routeId);
  const [body, setBody] = useState(previous?.body ?? '');
  const [headers, setHeaders] = useState<HeaderRow[]>(previous?.headers ?? []);
  const [jsonError, setJsonError] = useState<string>();
  const [sending, setSending] = useState(false);

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
    lastSent.set(routeId, { body, headers });
    const named: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) {
        named[key.trim()] = value;
      }
    }
    try {
      await onSend({ body, headers: named });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen variant={ModalVariant.medium} onClose={onClose} ouiaId="SendTestMessageModal">
      <ModalHeader
        title={`Send a test message to ${routeId}`}
        description="It goes to the endpoint the route starts from, in the running app."
      />
      <ModalBody>
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
        </Form>
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
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
