import { DynamicCatalogRegistry } from '../../../../dynamic-catalog';
import { IVisualizationNode } from '../../../../models/visualization/base-visual-entity';
import { isSendableEndpoint, resolveEndpointUri } from './endpoint-uri';

const node = (name: string, definition: unknown) =>
  ({ data: { primaryNodeId: { name }, definition } }) as unknown as IVisualizationNode;

describe('endpoint-uri', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only sends to `to` steps with a URI', () => {
    expect(isSendableEndpoint(node('to', { uri: 'kafka:shipping' }))).toBe(true);
    expect(isSendableEndpoint(node('to', 'kafka:shipping'))).toBe(true);
    expect(isSendableEndpoint(node('to', { uri: '' }))).toBe(false);
    expect(isSendableEndpoint(node('log', { message: 'hi' }))).toBe(false);
    expect(isSendableEndpoint(node('toD', { uri: 'kafka:${header.topic}' }))).toBe(false);
  });

  it('puts the parameters of the step in the URI, as the component syntax says', async () => {
    vi.spyOn(DynamicCatalogRegistry, 'get').mockReturnValue({
      getEntity: vi
        .fn()
        .mockResolvedValue({ component: { syntax: 'kafka:topic' }, propertiesSchema: { required: [] } }),
    } as unknown as ReturnType<typeof DynamicCatalogRegistry.get>);

    await expect(
      resolveEndpointUri(node('to', { uri: 'kafka', parameters: { topic: 'shipping', acks: 'all' } })),
    ).resolves.toBe('kafka:shipping?acks=all');
  });

  it('keeps the URI as written without a catalog entry', async () => {
    vi.spyOn(DynamicCatalogRegistry, 'get').mockReturnValue({
      getEntity: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof DynamicCatalogRegistry.get>);

    await expect(resolveEndpointUri(node('to', 'kafka:shipping'))).resolves.toBe('kafka:shipping');
  });
});
