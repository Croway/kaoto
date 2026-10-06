import { DynamicCatalogRegistry } from '../../../../dynamic-catalog';
import { CatalogKind } from '../../../../models/catalog-kind';
import { IVisualizationNode } from '../../../../models/visualization/base-visual-entity';
import { CamelUriHelper, ParsedParameters } from '../../../../utils/camel-uri-helper';
import { getValue } from '../../../../utils/get-value';

/** Whether a step sends to an endpoint a test message can be sent to (a `to` step with a URI). */
export const isSendableEndpoint = (vizNode: IVisualizationNode): boolean =>
  vizNode.data.primaryNodeId?.name === 'to' && !!CamelUriHelper.getUriString(vizNode.data.definition);

/** The full URI of the endpoint of a step, its parameters included (as the topology resolves them). */
export const resolveEndpointUri = async (vizNode: IVisualizationNode): Promise<string | undefined> => {
  const definition = vizNode.data.definition;
  const uri = CamelUriHelper.getUriString(definition);
  if (!uri) {
    return undefined;
  }
  const parameters = getValue(definition, 'parameters') as ParsedParameters | undefined;
  const component = await DynamicCatalogRegistry.get()
    .getEntity(CatalogKind.Component, CamelUriHelper.getSyntaxWithoutSchema(uri).schema)
    .catch(() => undefined);
  return component?.component.syntax
    ? CamelUriHelper.getUriStringFromParameters(uri, component.component.syntax, parameters, {
        requiredParameters: component.propertiesSchema.required as string[],
      })
    : CamelUriHelper.getUriStringFromParameters(uri, '', parameters);
};
