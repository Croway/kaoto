import {
  Button,
  Checkbox,
  ExpandableSection,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  NumberInput,
  TextInput,
} from '@patternfly/react-core';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Bean, ConfigurationProperty, Factory } from '../../models/forage-components-catalog';
import { ForageCatalogService } from '../../services/forage-catalog.service';
import './ForageBeanWizardModal.scss';

interface ForageBeanWizardModalProps {
  /** The Camel component name (e.g., "camel-sql", "camel-langchain4j-agent") */
  componentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectBean?: (bean: Bean, configuration: Record<string, string | number | boolean>) => void;
}

enum WizardStep {
  SelectBean = 'select-bean',
  ConfigureProperties = 'configure-properties',
}

/**
 * Wizard modal to display and select beans from the Forage catalog
 * based on the current component
 */
export const ForageBeanWizardModal: FunctionComponent<ForageBeanWizardModalProps> = ({
  componentName,
  isOpen,
  onClose,
  onSelectBean,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SelectBean);
  const [selectedBean, setSelectedBean] = useState<Bean | null>(null);
  const [configuration, setConfiguration] = useState<Record<string, string | number | boolean>>({});
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [camelBeanName, setCamelBeanName] = useState<string>('');
  const [camelBeanNameError, setCamelBeanNameError] = useState<string>('');

  // Get all beans that support this component
  const availableBeans = useMemo(() => {
    return ForageCatalogService.getBeansByComponent(componentName);
  }, [componentName]);

  // Group beans by feature if they have a non-empty feature field
  const groupedBeans = useMemo(() => {
    const groups: Record<string, Bean[]> = {};
    const ungrouped: Bean[] = [];

    availableBeans.forEach((bean) => {
      if (bean.feature && bean.feature.trim() !== '') {
        if (!groups[bean.feature]) {
          groups[bean.feature] = [];
        }
        groups[bean.feature].push(bean);
      } else {
        ungrouped.push(bean);
      }
    });

    return { groups, ungrouped };
  }, [availableBeans]);

  // Get configuration properties for the selected bean
  const configurationProperties = useMemo(() => {
    if (!selectedBean) return [];
    return ForageCatalogService.getConfigurationPropertiesForBean(selectedBean.name);
  }, [selectedBean]);

  // Group properties by configTag
  const groupedProperties = useMemo(() => {
    const commonOrEmpty: ConfigurationProperty[] = [];
    const grouped: Record<string, ConfigurationProperty[]> = {};

    configurationProperties.forEach((prop) => {
      const tag = prop.configTag?.toUpperCase();
      if (!tag || tag === 'COMMON') {
        commonOrEmpty.push(prop);
      } else {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(prop);
      }
    });

    return { commonOrEmpty, grouped };
  }, [configurationProperties]);

  // Reset wizard when modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(WizardStep.SelectBean);
      setSelectedBean(null);
      setConfiguration({});
      setCamelBeanName('');
      setCamelBeanNameError('');
    }
  }, [isOpen]);

  const handleSelectBean = (bean: Bean) => {
    setSelectedBean(bean);
    setCurrentStep(WizardStep.ConfigureProperties);
  };

  const handleBack = () => {
    setCurrentStep(WizardStep.SelectBean);
    setSelectedBean(null);
    setConfiguration({});
  };

  const handlePropertyChange = (propertyName: string, value: string | number | boolean) => {
    setConfiguration((prev) => ({
      ...prev,
      [propertyName]: value,
    }));
  };

  const handleCamelBeanNameChange = (value: string) => {
    setCamelBeanName(value);
    // Validate: no spaces allowed in Java bean names
    if (value.includes(' ')) {
      setCamelBeanNameError('Camel Bean Name cannot contain spaces');
    } else {
      setCamelBeanNameError('');
    }
  };

  const handleFinish = () => {
    if (selectedBean) {
      onSelectBean?.(selectedBean, configuration);
    }
    onClose();
    setIsSummaryModalOpen(true);
  };

  const handleCloseSummaryModal = () => {
    setIsSummaryModalOpen(false);
  };

  /**
   * Get catalog information for the selected bean
   */
  const getCatalogInfo = () => {
    if (!selectedBean) return null;

    const catalog = ForageCatalogService.getCatalog();
    if (!catalog) return null;

    // Find the component that contains this bean
    const component = catalog.components.find((comp) => comp.beans.some((bean) => bean.name === selectedBean.name));

    if (!component) return null;

    // Find Spring Boot variant (artifact ending with -starter)
    const baseArtifactId = component.artifactId.replace(/-starter$/, '').replace(/-quarkus$/, '');
    const springBootComponent = catalog.components.find((comp) => comp.artifactId === `${baseArtifactId}-starter`);

    // Find Quarkus variant (artifact ending with -quarkus or just the base if it's already quarkus)
    const quarkusComponent = catalog.components.find(
      (comp) =>
        comp.artifactId === `${baseArtifactId}-quarkus` ||
        (component.artifactId.includes('quarkus') && comp.artifactId === baseArtifactId),
    );

    // Get non-empty configuration properties
    // Include bean-name type properties even if not in configuration state
    // Include properties with default values even if not explicitly configured
    const nonEmptyProperties = configurationProperties.filter((prop) => {
      const normalizedType = prop.type.toLowerCase();

      // Always include bean-name type properties
      if (normalizedType === 'bean-name') {
        return true;
      }

      const value = configuration[prop.name];
      const hasConfiguredValue = value !== undefined && value !== '' && value !== null;
      const hasDefaultValue = prop.defaultValue !== undefined && prop.defaultValue !== '' && prop.defaultValue !== null;

      return hasConfiguredValue || hasDefaultValue;
    });

    // Get dependant beans for the selected bean
    const dependantBeansData = ForageCatalogService.getDependantBeansForBean(selectedBean.name);

    // Get all configuration properties from all related components (including -common)
    // This is needed because dependsOnProperty might reference properties from the -common component
    const commonArtifactId = `${baseArtifactId.split('-').slice(0, 2).join('-')}-common`;
    const allRelatedProperties: ConfigurationProperty[] = [...configurationProperties];

    // Add properties from -common component if it exists
    const commonComponent = catalog.components.find((comp) => comp.artifactId === commonArtifactId);
    if (commonComponent) {
      allRelatedProperties.push(...commonComponent.configurationProperties);
    }

    // Filter dependant beans based on whether their dependsOnProperty is configured
    const activeDependantBeans = dependantBeansData.filter((depBeanData) => {
      const depBean = depBeanData.bean;

      // If there's no dependsOnProperty, the bean is always active
      if (!depBean.dependsOnProperty) {
        return true;
      }

      // Check if the property is configured with a non-empty value
      const propertyValue = configuration[depBean.dependsOnProperty];

      // For boolean properties, check if the value is explicitly true or 'true'
      if (propertyValue === true || propertyValue === 'true') {
        return true;
      }

      // For other types, check for non-empty values
      const hasConfiguredValue =
        propertyValue !== undefined &&
        propertyValue !== '' &&
        propertyValue !== null &&
        propertyValue !== false &&
        propertyValue !== 'false';

      // Also check if the property has a default value that is truthy
      const property = allRelatedProperties.find((p) => p.name === depBean.dependsOnProperty);
      const hasDefaultValue = property?.defaultValue === 'true';

      return hasConfiguredValue || hasDefaultValue;
    });

    // Get factories that support the same Camel components as the selected bean
    // Beans and factories are related through their shared "components" field
    // Store factory along with its component metadata (artifactId, groupId, version)
    const factories: Array<Factory & { artifactId: string; groupId: string; version: string }> = [];
    catalog.components.forEach((comp) => {
      comp.factories.forEach((factory) => {
        // Check if the factory supports any of the same components as the selected bean
        const hasMatchingComponent = factory.components.some((factoryComp) =>
          selectedBean.components.includes(factoryComp),
        );
        if (hasMatchingComponent && !factories.find((f) => f.name === factory.name)) {
          factories.push({
            ...factory,
            artifactId: comp.artifactId,
            groupId: comp.groupId,
            version: comp.version,
          });
        }
      });

      // Also check runtime-specific factories (nested in factory.runtimes)
      comp.factories.forEach((factory) => {
        factory.runtimes?.forEach((runtime) => {
          runtime.factories.forEach((runtimeFactory) => {
            // If the parent factory matches, the runtime factory also matches
            // (even if runtimeFactory.components is empty)
            const parentMatches = factory.components.some((factoryComp) =>
              selectedBean.components.includes(factoryComp),
            );

            // Check if the runtime factory explicitly lists matching components
            const runtimeMatches =
              runtimeFactory.components.length > 0 &&
              runtimeFactory.components.some((factoryComp) => selectedBean.components.includes(factoryComp));

            const hasMatchingComponent = parentMatches || runtimeMatches;

            if (
              hasMatchingComponent &&
              !factories.find((f) => f.name === runtimeFactory.name && f.artifactId === runtime.artifactId)
            ) {
              factories.push({
                ...runtimeFactory,
                artifactId: runtime.artifactId,
                groupId: runtime.groupId,
                version: runtime.version,
                // Use the runtime's runtimeType instead of the nested factory's runtimeType
                runtimeType: runtime.runtimeType,
              });
            }
          });
        });
      });
    });

    return {
      component,
      springBootComponent,
      quarkusComponent,
      nonEmptyProperties,
      factories,
      activeDependantBeans,
    };
  };

  /**
   * Renders the appropriate input field based on the property type
   */
  const renderPropertyField = (prop: ConfigurationProperty) => {
    const fieldId = `prop-${prop.name}`;
    const normalizedType = prop.type.toLowerCase();

    // Get current value or default value
    const currentValue = configuration[prop.name] !== undefined ? configuration[prop.name] : prop.defaultValue;

    // Bean Name - Read-only field showing the selected bean name
    if (normalizedType === 'bean-name') {
      const beanName = selectedBean?.name || '';
      return <TextInput id={fieldId} readOnly type="text" value={beanName} aria-label={prop.name} />;
    }

    // Boolean/Checkbox
    if (normalizedType === 'boolean') {
      const isChecked = currentValue === 'true' || currentValue === true;
      return (
        <Checkbox
          id={fieldId}
          label={<span className="forage-bean-wizard__checkbox-label">{prop.label || prop.name}</span>}
          isChecked={isChecked}
          onChange={(_event, checked) => handlePropertyChange(prop.name, checked)}
          aria-label={prop.name}
        />
      );
    }

    // Integer/Number
    if (normalizedType === 'integer' || normalizedType === 'int' || normalizedType === 'number') {
      const numValue = currentValue ? Number(currentValue) : undefined;
      return (
        <NumberInput
          id={fieldId}
          value={numValue}
          onMinus={() => {
            const current = numValue || 0;
            handlePropertyChange(prop.name, current - 1);
          }}
          onPlus={() => {
            const current = numValue || 0;
            handlePropertyChange(prop.name, current + 1);
          }}
          onChange={(event) => {
            const value = (event.target as HTMLInputElement).value;
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              handlePropertyChange(prop.name, parsed);
            }
          }}
          inputAriaLabel={prop.name}
          minusBtnAriaLabel="Decrease"
          plusBtnAriaLabel="Increase"
        />
      );
    }

    // Password
    if (normalizedType === 'password') {
      return (
        <TextInput
          id={fieldId}
          type="password"
          value={String(currentValue || '')}
          onChange={(_event, value) => handlePropertyChange(prop.name, value)}
          placeholder={prop.example ?? undefined}
          aria-label={prop.name}
        />
      );
    }

    // Default: Text input
    return (
      <TextInput
        id={fieldId}
        type="text"
        value={String(currentValue || '')}
        onChange={(_event, value) => handlePropertyChange(prop.name, value)}
        placeholder={prop.example ?? undefined}
        aria-label={prop.name}
      />
    );
  };

  /**
   * Renders a property form group with label, field, and helper text
   */
  const renderPropertyGroup = (prop: ConfigurationProperty) => {
    const normalizedType = prop.type.toLowerCase();
    const isBoolean = normalizedType === 'boolean';

    // For booleans, the checkbox itself contains the label
    if (isBoolean) {
      return (
        <FormGroup key={prop.name} fieldId={`prop-${prop.name}`}>
          {renderPropertyField(prop)}
          {prop.description && (
            <HelperText>
              <HelperTextItem>{prop.description}</HelperTextItem>
            </HelperText>
          )}
          {prop.defaultValue && (
            <HelperText>
              <HelperTextItem>Default: {prop.defaultValue}</HelperTextItem>
            </HelperText>
          )}
        </FormGroup>
      );
    }

    // For other types, show label separately
    return (
      <FormGroup
        key={prop.name}
        label={prop.label || prop.name}
        isRequired={prop.required}
        fieldId={`prop-${prop.name}`}
      >
        {renderPropertyField(prop)}
        {prop.description && (
          <HelperText>
            <HelperTextItem>{prop.description}</HelperTextItem>
          </HelperText>
        )}
        {prop.defaultValue && (
          <HelperText>
            <HelperTextItem>Default: {prop.defaultValue}</HelperTextItem>
          </HelperText>
        )}
      </FormGroup>
    );
  };

  const renderStepContent = () => {
    if (currentStep === WizardStep.SelectBean) {
      return (
        <>
          <p>
            Select a bean provider for <strong>{componentName}</strong>:
          </p>

          {availableBeans.length === 0 ? (
            <p className="forage-bean-wizard__empty">No bean providers available for this component.</p>
          ) : (
            <div className="forage-bean-wizard__provider-list">
              {/* Render ungrouped beans first */}
              {groupedBeans.ungrouped.length > 0 && (
                <div className="forage-bean-wizard__ungrouped-beans">
                  {groupedBeans.ungrouped.map((bean) => (
                    <Button
                      key={bean.name}
                      variant="primary"
                      onClick={() => handleSelectBean(bean)}
                      className="forage-bean-wizard__provider-button"
                    >
                      {bean.description}
                    </Button>
                  ))}
                </div>
              )}

              {/* Render grouped beans by feature */}
              {Object.entries(groupedBeans.groups).map(([feature, beans]) => (
                <div key={feature} className="forage-bean-wizard__feature-group">
                  <h3 className="forage-bean-wizard__feature-title">{feature}</h3>
                  <div className="forage-bean-wizard__feature-beans">
                    {beans.map((bean) => (
                      <Button
                        key={bean.name}
                        variant="primary"
                        onClick={() => handleSelectBean(bean)}
                        className="forage-bean-wizard__provider-button"
                      >
                        {bean.description}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    // Configure Properties Step
    return (
      <>
        <div className="forage-bean-wizard__selected-bean">
          <p>
            <strong>Selected Provider:</strong> {selectedBean?.name}
          </p>
          <p className="forage-bean-wizard__bean-description">{selectedBean?.description}</p>
        </div>

        {configurationProperties.length === 0 ? (
          <p className="forage-bean-wizard__empty">No configuration properties available for this bean provider.</p>
        ) : (
          <Form className="forage-bean-wizard__form">
            {/* Camel Bean Name input - required field */}
            <FormGroup
              label="Camel Bean Name"
              isRequired
              fieldId="camel-bean-name"
              helperTextInvalid={camelBeanNameError}
              validated={camelBeanNameError ? 'error' : 'default'}
            >
              <TextInput
                id="camel-bean-name"
                type="text"
                value={camelBeanName}
                onChange={(_event, value) => handleCamelBeanNameChange(value)}
                placeholder="e.g., myBean"
                aria-label="Camel Bean Name"
                validated={camelBeanNameError ? 'error' : 'default'}
                isRequired
              />
              <HelperText>
                <HelperTextItem>Java bean name - no spaces allowed</HelperTextItem>
              </HelperText>
            </FormGroup>

            <p className="forage-bean-wizard__form-intro">Configure the properties for this bean provider:</p>

            {/* Render common/empty configTag properties (always visible) */}
            {groupedProperties.commonOrEmpty.length > 0 && (
              <div className="forage-bean-wizard__common-properties">
                {groupedProperties.commonOrEmpty.map((prop) => renderPropertyGroup(prop))}
              </div>
            )}

            {/* Render grouped properties in collapsible sections */}
            {Object.entries(groupedProperties.grouped).map(([tag, properties]) => (
              <ExpandableSection key={tag} toggleText={tag.charAt(0) + tag.slice(1).toLowerCase()} isIndented>
                {properties.map((prop) => renderPropertyGroup(prop))}
              </ExpandableSection>
            ))}
          </Form>
        )}
      </>
    );
  };

  const catalogInfo = getCatalogInfo();

  return (
    <>
      {/* Main Wizard Modal */}
      <Modal
        variant={ModalVariant.large}
        isOpen={isOpen}
        onClose={onClose}
        aria-labelledby="forage-bean-wizard-title"
        aria-describedby="forage-bean-wizard-description"
      >
        <ModalHeader
          title={currentStep === WizardStep.SelectBean ? 'Select Bean Provider' : 'Configure Properties'}
          labelId="forage-bean-wizard-title"
        />
        <ModalBody id="forage-bean-wizard-description">{renderStepContent()}</ModalBody>
        <ModalFooter>
          {currentStep === WizardStep.ConfigureProperties && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          {currentStep === WizardStep.ConfigureProperties ? (
            <Button variant="primary" onClick={handleFinish}>
              Finish
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* Summary Modal */}
      <Modal
        variant={ModalVariant.large}
        isOpen={isSummaryModalOpen}
        onClose={handleCloseSummaryModal}
        aria-labelledby="forage-bean-summary-title"
        aria-describedby="forage-bean-summary-description"
      >
        <ModalHeader title="Bean Configuration Summary" labelId="forage-bean-summary-title" />
        <ModalBody id="forage-bean-summary-description">
          {catalogInfo && (
            <div className="forage-bean-wizard__summary">
              <h3>Bean Information</h3>
              <p>
                <strong>Database kind:</strong> {selectedBean?.name}
              </p>
              <p>
                <strong>Description:</strong> {selectedBean?.description}
              </p>
              {camelBeanName && (
                <p>
                  <strong>Camel Bean Name:</strong> {camelBeanName}
                </p>
              )}

              <h3>Component Maven Coordinates</h3>
              <div className="forage-bean-wizard__maven-info">
                <h4>Current Component</h4>
                <p>
                  <strong>Group ID:</strong> {catalogInfo.component.groupId}
                </p>
                <p>
                  <strong>Artifact ID:</strong> {catalogInfo.component.artifactId}
                </p>
                <p>
                  <strong>Version:</strong> {catalogInfo.component.version}
                </p>
              </div>

              {catalogInfo.springBootComponent && (
                <div className="forage-bean-wizard__maven-info">
                  <h4>Camel Spring Boot Starter</h4>
                  <p>
                    <strong>Group ID:</strong> {catalogInfo.springBootComponent.groupId}
                  </p>
                  <p>
                    <strong>Artifact ID:</strong> {catalogInfo.springBootComponent.artifactId}
                  </p>
                  <p>
                    <strong>Version:</strong> {catalogInfo.springBootComponent.version}
                  </p>
                </div>
              )}

              {catalogInfo.quarkusComponent && (
                <div className="forage-bean-wizard__maven-info">
                  <h4>Camel Quarkus</h4>
                  <p>
                    <strong>Group ID:</strong> {catalogInfo.quarkusComponent.groupId}
                  </p>
                  <p>
                    <strong>Artifact ID:</strong> {catalogInfo.quarkusComponent.artifactId}
                  </p>
                  <p>
                    <strong>Version:</strong> {catalogInfo.quarkusComponent.version}
                  </p>
                </div>
              )}

              <h3>Configured Properties</h3>
              {catalogInfo.nonEmptyProperties.length > 0 ? (
                <ul className="forage-bean-wizard__property-list">
                  {catalogInfo.nonEmptyProperties.map((prop) => {
                    const normalizedType = prop.type.toLowerCase();
                    let displayValue: string;

                    // For bean-name type, show the selected bean name
                    if (normalizedType === 'bean-name') {
                      displayValue = selectedBean?.name || '';
                    } else {
                      // Use configured value if present, otherwise use default value
                      const configuredValue = configuration[prop.name];
                      displayValue =
                        configuredValue !== undefined && configuredValue !== '' && configuredValue !== null
                          ? String(configuredValue)
                          : String(prop.defaultValue || '');
                    }

                    return (
                      <li key={prop.name}>
                        <strong>{prop.name}:</strong> {displayValue}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="forage-bean-wizard__empty">No properties configured.</p>
              )}

              <h3>Factories</h3>
              {catalogInfo.factories.length > 0 ? (
                <div className="forage-bean-wizard__factory-list">
                  {catalogInfo.factories.map((factory) => (
                    <div key={factory.name} className="forage-bean-wizard__factory-info">
                      <p>
                        <strong>Factory Name:</strong> {factory.name}
                      </p>
                      <p>
                        <strong>Description:</strong> {factory.description}
                      </p>
                      <p>
                        <strong>Type:</strong> {factory.factoryType}
                      </p>
                      <p>
                        <strong>Class Name:</strong> {factory.className}
                      </p>
                      <p>
                        <strong>Autowired:</strong> {factory.autowired ? 'Yes' : 'No'}
                      </p>
                      <p>
                        <strong>Supported Components:</strong> {factory.components.join(', ')}
                      </p>
                      <div className="forage-bean-wizard__factory-maven">
                        <p>
                          <strong>Group ID:</strong> {factory.groupId}
                        </p>
                        <p>
                          <strong>Artifact ID:</strong> {factory.artifactId}
                        </p>
                        <p>
                          <strong>Version:</strong> {factory.version}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="forage-bean-wizard__empty">No factories available for this component.</p>
              )}

              <div></div>

              <h1>
                Properties to add to the <b>application.properties:</b>
              </h1>
              {(() => {
                // Categorize factories based on their runtimeType field
                const mainDeps: Array<(typeof catalogInfo.factories)[0]> = [];
                const springBootDeps: Array<(typeof catalogInfo.factories)[0]> = [];
                const quarkusDeps: Array<(typeof catalogInfo.factories)[0]> = [];
                const genericDeps: string[] = [];

                const formatGAV = (factory: (typeof catalogInfo.factories)[0]) =>
                  `${factory.groupId}:${factory.artifactId}:${factory.version}`;

                // Categorize factories based on runtimeType
                catalogInfo.factories.forEach((factory) => {
                  const runtimeType = factory.runtimeType?.toLowerCase();

                  if (runtimeType === 'main') {
                    mainDeps.push(factory);
                  } else if (runtimeType === 'spring-boot') {
                    springBootDeps.push(factory);
                  } else if (runtimeType === 'quarkus') {
                    quarkusDeps.push(factory);
                  }
                  // If runtimeType is empty/null, it will be handled with the bean component
                });

                // Add selected bean component to generic dependencies
                if (selectedBean) {
                  genericDeps.push(
                    `${catalogInfo.component.groupId}:${catalogInfo.component.artifactId}:${catalogInfo.component.version}`,
                  );
                }

                return (
                  <>
                    {genericDeps.length > 0 && (
                      <div className="forage-bean-wizard__deps-section">
                        <p>
                          <strong>camel.jbang.dependencies=</strong>
                          {genericDeps.join(',')}
                        </p>
                      </div>
                    )}

                    {mainDeps.length > 0 && (
                      <div className="forage-bean-wizard__deps-section">
                        <p>
                          <strong>camel.jbang.dependencies.main=</strong>
                          {mainDeps.map((factory, index) => (
                            <span key={factory.name}>
                              {index > 0 && ','}
                              {formatGAV(factory)}
                            </span>
                          ))}
                        </p>
                      </div>
                    )}

                    {springBootDeps.length > 0 && (
                      <div className="forage-bean-wizard__deps-section">
                        <p>
                          <strong>camel.jbang.dependencies.spring-boot=</strong>
                          {springBootDeps.map((factory, index) => (
                            <span key={factory.name}>
                              {index > 0 && ','}
                              {formatGAV(factory)}
                            </span>
                          ))}
                        </p>
                      </div>
                    )}

                    {quarkusDeps.length > 0 && (
                      <div className="forage-bean-wizard__deps-section">
                        <p>
                          <strong>camel.jbang.dependencies.quarkus=</strong>
                          {quarkusDeps.map((factory, index) => (
                            <span key={factory.name}>
                              {index > 0 && ','}
                              {formatGAV(factory)}
                            </span>
                          ))}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              <h3>
                Properties to add to the <b>TODO.properties:</b>
              </h3>
              {catalogInfo.nonEmptyProperties.length > 0 ? (
                <div className="forage-bean-wizard__todo-properties">
                  {catalogInfo.nonEmptyProperties.map((prop) => {
                    const normalizedType = prop.type.toLowerCase();
                    let displayValue: string;

                    // For bean-name type, show the selected bean name
                    if (normalizedType === 'bean-name') {
                      displayValue = selectedBean?.name || '';
                    } else {
                      // Use configured value if present, otherwise use default value
                      const configuredValue = configuration[prop.name];
                      displayValue =
                        configuredValue !== undefined && configuredValue !== '' && configuredValue !== null
                          ? String(configuredValue)
                          : String(prop.defaultValue || '');
                    }

                    // Use Camel Bean Name as root prefix if provided
                    const propertyName = camelBeanName ? `${camelBeanName}.${prop.name}` : prop.name;

                    return (
                      <p key={prop.name}>
                        <strong>{propertyName}=</strong>
                        {displayValue}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="forage-bean-wizard__empty">No properties configured.</p>
              )}

              <h3>Main Bean</h3>
              {camelBeanName && catalogInfo.factories.length > 0 ? (
                <div className="forage-bean-wizard__current-bean-info">
                  {(() => {
                    // Deduplicate factories by beanType - prefer main runtime, then empty runtimeType, then first occurrence
                    const uniqueBeanTypes = new Map<string, typeof catalogInfo.factories[0]>();

                    catalogInfo.factories.forEach((factory) => {
                      const existing = uniqueBeanTypes.get(factory.beanType);
                      if (!existing) {
                        uniqueBeanTypes.set(factory.beanType, factory);
                      } else {
                        // Prefer 'main' runtime, then empty/null runtimeType
                        const existingRuntime = existing.runtimeType?.toLowerCase();
                        const currentRuntime = factory.runtimeType?.toLowerCase();

                        if (currentRuntime === 'main' || (!currentRuntime && existingRuntime)) {
                          uniqueBeanTypes.set(factory.beanType, factory);
                        }
                      }
                    });

                    return Array.from(uniqueBeanTypes.values()).map((factory) => (
                      <div key={factory.beanType} className="forage-bean-wizard__current-bean-item">
                        <p>
                          <strong>Bean Name:</strong> {camelBeanName}
                        </p>
                        <p>
                          <strong>Bean Type:</strong> {factory.beanType}
                        </p>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="forage-bean-wizard__empty">No main bean generated.</p>
              )}

              <h3>Dependant Beans</h3>
              {catalogInfo.activeDependantBeans.length > 0 ? (
                <div className="forage-bean-wizard__dependant-beans-list">
                  {catalogInfo.activeDependantBeans.map((depBeanData, index) => {
                    const depBean = depBeanData.bean;
                    // Get bean name from configuration by finding a property that matches propertyBeanName
                    // For example: if propertyBeanName = "jdbc.idempotent.repository.name",
                    // look through nonEmptyProperties to find the property with name matching propertyBeanName
                    // and get its configured value
                    let beanNameValue: string | undefined = undefined;

                    if (depBean.propertyBeanName && depBean.propertyBeanName.trim() !== '') {
                      console.log('[ForageBeanWizard] Looking for propertyBeanName:', depBean.propertyBeanName);
                      console.log('[ForageBeanWizard] nonEmptyProperties:', catalogInfo.nonEmptyProperties);

                      // Find the property in nonEmptyProperties that matches propertyBeanName
                      const matchingProperty = catalogInfo.nonEmptyProperties.find(
                        (prop) => prop.name === depBean.propertyBeanName,
                      );

                      console.log('[ForageBeanWizard] matchingProperty:', matchingProperty);

                      if (matchingProperty) {
                        // Get the configured value or default value for this property
                        const configuredValue = configuration[matchingProperty.name];
                        console.log('[ForageBeanWizard] configuredValue:', configuredValue);
                        beanNameValue =
                          configuredValue !== undefined && configuredValue !== '' && configuredValue !== null
                            ? String(configuredValue)
                            : matchingProperty.defaultValue
                              ? String(matchingProperty.defaultValue)
                              : undefined;
                        console.log('[ForageBeanWizard] beanNameValue:', beanNameValue);
                      }
                    }

                    return (
                      <>
                        <div key={`${depBean.beanType}-${index}`} className="forage-bean-wizard__dependant-bean-info">
                          {beanNameValue && (
                            <p>
                              <strong>Bean Name:</strong> {beanNameValue}
                            </p>
                          )}
                          <p>
                            <strong>Bean Type:</strong> {depBean.beanType}
                          </p>
                          {depBean.namedBeans && depBean.namedBeans.length > 0 && (
                            <p>
                              <strong>Named Beans:</strong> {depBean.namedBeans.join(', ')}
                            </p>
                          )}
                        </div>
                        {index < catalogInfo.activeDependantBeans.length - 1 && <br />}
                      </>
                    );
                  })}
                </div>
              ) : (
                <p className="forage-bean-wizard__empty">No dependant beans available for the current configuration.</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleCloseSummaryModal}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
