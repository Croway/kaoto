import { CanvasFormTabsContext, FilteredFieldContext, FormTabsModes } from '@kaoto/forms';
import { Button, Grid, GridItem, SearchInput, Title, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { FunctionComponent, useContext, useMemo, useState } from 'react';
import { ForageBeanWizardModal } from '../../../ForageBeanWizard';
import { Bean, IVisualizationNode } from '../../../../models';
import { ForageCatalogService } from '../../../../services/forage-catalog.service';
import './CanvasFormHeader.scss';

interface CanvasFormHeaderProps {
  nodeId: string;
  title?: string;
  nodeIcon?: string;
  vizNode?: IVisualizationNode;
  onClose?: () => void;
}

export const CanvasFormHeader: FunctionComponent<CanvasFormHeaderProps> = (props) => {
  const { filteredFieldText, onFilterChange } = useContext(FilteredFieldContext);
  const canvasFormTabsContext = useContext(CanvasFormTabsContext);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  /**
   * Extract the Camel component name from the vizNode
   */
  const componentName = useMemo(() => {
    if (!props.vizNode) return undefined;

    const componentSchema = props.vizNode.getComponentSchema();
    if (!componentSchema?.definition) return undefined;

    const definition = componentSchema.definition;
    let name: string | undefined;

    // Try to extract component name from common locations
    if (definition.uri) {
      // For components with URI (e.g., "timer:foo", "langchain4j-agent:myAgent")
      const uriParts = definition.uri.split(':');
      name = uriParts[0];
    } else if (definition.component) {
      name = definition.component;
    }

    if (!name) return undefined;

    // Convert to Camel component format (e.g., "langchain4j-agent" -> "camel-langchain4j-agent")
    return name.startsWith('camel-') ? name : `camel-${name}`;
  }, [props.vizNode]);

  /**
   * Check if the current component should show the wizard button
   * based on whether it matches any factory components in the Forage catalog
   */
  const shouldShowWizard = useMemo(() => {
    if (!componentName) return false;

    // Check if any factory in the Forage catalog supports this component
    const factories = ForageCatalogService.getAllFactories();
    return factories.some((factory) => factory.components.some((comp) => comp === componentName));
  }, [componentName]);

  const handleWizardClick = () => {
    setIsWizardOpen(true);
  };

  const handleWizardClose = () => {
    setIsWizardOpen(false);
  };

  const handleSelectBean = (bean: Bean, configuration: Record<string, string | number | boolean>) => {
    console.log('[CanvasFormHeader] Selected bean:', bean);
    console.log('[CanvasFormHeader] Configuration:', configuration);
    // TODO: Integrate the selected bean and configuration into the component configuration
  };

  return (
    <>
      <Grid hasGutter>
        <GridItem className="form-header" span={11}>
          <img className={`form-header__icon-${props.nodeId}`} src={props.nodeIcon} alt="icon" />
          <Title className="form-header__title" headingLevel="h2">
            {props.title}
          </Title>
        </GridItem>
        <GridItem span={1}>
          <Button data-testid="close-side-bar" variant="plain" icon={<TimesIcon />} onClick={props.onClose} />
        </GridItem>
        {shouldShowWizard && (
          <GridItem span={12} className="form-header__wizard-container">
            <Button
              variant="primary"
              size="lg"
              ouiaId="Primary"
              data-testid="wizard-button"
              onClick={handleWizardClick}
              className="form-header__wizard-button"
            >
              <b>Wizard</b>
            </Button>
          </GridItem>
        )}
      </Grid>

      {canvasFormTabsContext && (
        <ToggleGroup aria-label="Single selectable form tabs" className="form-tabs">
          {Object.entries(FormTabsModes).map(([mode, tooltip]) => (
            <ToggleGroupItem
              title={tooltip}
              key={mode}
              text={mode}
              buttonId={mode}
              isSelected={canvasFormTabsContext.selectedTab === mode}
              onChange={() => {
                canvasFormTabsContext.setSelectedTab(mode as keyof typeof FormTabsModes);
              }}
            />
          ))}
        </ToggleGroup>
      )}

      <SearchInput
        className="filter-fields"
        placeholder="Find properties by name"
        data-testid="filter-fields"
        value={filteredFieldText}
        onChange={onFilterChange}
        onClear={onFilterChange}
      />

      {componentName && (
        <ForageBeanWizardModal
          componentName={componentName}
          isOpen={isWizardOpen}
          onClose={handleWizardClose}
          onSelectBean={handleSelectBean}
        />
      )}
    </>
  );
};
