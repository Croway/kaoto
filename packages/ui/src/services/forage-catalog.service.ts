import { ForageCatalog } from '../models/forage-components-catalog';

/**
 * Service to manage the Forage catalog for Camel AI/ML components
 */
export class ForageCatalogService {
  private static catalog: ForageCatalog | null = null;
  private static catalogPath: string = '';

  /**
   * Load the Forage catalog from a JSON file
   * @param path - Path to the forage-catalog.json file
   */
  static async loadCatalog(path: string): Promise<ForageCatalog> {
    try {
      console.log(`[ForageCatalogService] Loading catalog from: ${path}`);
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load Forage catalog from ${path}: ${response.statusText}`);
      }
      const catalog: ForageCatalog = await response.json();
      this.catalog = catalog;
      this.catalogPath = path;
      console.log(`[ForageCatalogService] Catalog loaded successfully:`, {
        version: catalog.version,
        components: catalog.components.length,
        totalBeans: catalog.components.reduce((sum, c) => sum + c.beans.length, 0),
        totalFactories: catalog.components.reduce((sum, c) => sum + c.factories.length, 0),
      });
      return catalog;
    } catch (error) {
      console.error('[ForageCatalogService] Error loading Forage catalog:', error);
      throw error;
    }
  }

  /**
   * Get the loaded Forage catalog
   * @returns The loaded catalog or null if not loaded
   */
  static getCatalog(): ForageCatalog | null {
    return this.catalog;
  }

  /**
   * Get the path from which the catalog was loaded
   */
  static getCatalogPath(): string {
    return this.catalogPath;
  }

  /**
   * Get a component by artifact ID
   * @param artifactId - The artifact ID to search for
   */
  static getComponentByArtifactId(artifactId: string) {
    return this.catalog?.components.find((component) => component.artifactId === artifactId);
  }

  /**
   * Get all beans from all components
   */
  static getAllBeans() {
    if (!this.catalog) return [];
    return this.catalog.components.flatMap((component) => component.beans);
  }

  /**
   * Get all factories from all components
   */
  static getAllFactories() {
    if (!this.catalog) return [];
    return this.catalog.components.flatMap((component) => component.factories);
  }

  /**
   * Get beans by name
   * @param name - The bean name to search for
   */
  static getBeanByName(name: string) {
    const allBeans = this.getAllBeans();
    return allBeans.find((bean) => bean.name === name);
  }

  /**
   * Get factory by name
   * @param name - The factory name to search for
   */
  static getFactoryByName(name: string) {
    const allFactories = this.getAllFactories();
    return allFactories.find((factory) => factory.name === name);
  }

  /**
   * Get all configuration properties from all components
   */
  static getAllConfigurationProperties() {
    if (!this.catalog) return [];
    return this.catalog.components.flatMap((component) =>
      component.configurationProperties.map((prop) => ({
        ...prop,
        artifactId: component.artifactId,
      })),
    );
  }

  /**
   * Extract the base artifact name from a full artifact ID
   * Examples:
   * - "forage-jdbc-postgresql" -> "forage-jdbc"
   * - "forage-vectordb-chroma" -> "forage-vectordb"
   * - "forage-model-azure-openai" -> "forage-model"
   */
  private static getBaseArtifactName(artifactId: string): string {
    const parts = artifactId.split('-');
    // Return first two parts (e.g., "forage-jdbc", "forage-vectordb")
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : artifactId;
  }

  /**
   * Get configuration properties for a specific bean with hierarchical fallback
   *
   * Resolution order:
   * 1. Properties from the component containing the bean (e.g., "forage-jdbc-postgresql")
   * 2. If empty, search in "-common" variant (e.g., "forage-jdbc-common")
   * 3. If still empty, search in base component (e.g., "forage-jdbc")
   *
   * @param beanName - The bean name to search for
   * @returns Array of configuration properties
   */
  static getConfigurationPropertiesForBean(beanName: string) {
    if (!this.catalog) return [];

    // Find the component that contains this bean
    const component = this.catalog.components.find((comp) => comp.beans.some((bean) => bean.name === beanName));

    if (!component) return [];

    // Step 1: Check if the component itself has properties
    if (component.configurationProperties.length > 0) {
      console.log(
        `[ForageCatalogService] Found ${component.configurationProperties.length} properties in ${component.artifactId}`,
      );
      return component.configurationProperties;
    }

    // Step 2: Try to find properties in the "-common" variant
    const baseArtifactName = this.getBaseArtifactName(component.artifactId);
    const commonArtifactId = `${baseArtifactName}-common`;
    const commonComponent = this.catalog.components.find((comp) => comp.artifactId === commonArtifactId);

    if (commonComponent && commonComponent.configurationProperties.length > 0) {
      console.log(
        `[ForageCatalogService] Found ${commonComponent.configurationProperties.length} properties in ${commonArtifactId} (common fallback)`,
      );
      return commonComponent.configurationProperties;
    }

    // Step 3: Try to find properties in the base component
    const baseComponent = this.catalog.components.find((comp) => comp.artifactId === baseArtifactName);

    if (baseComponent && baseComponent.configurationProperties.length > 0) {
      console.log(
        `[ForageCatalogService] Found ${baseComponent.configurationProperties.length} properties in ${baseArtifactName} (base fallback)`,
      );
      return baseComponent.configurationProperties;
    }

    console.log(
      `[ForageCatalogService] No properties found for bean ${beanName} in ${component.artifactId}, ${commonArtifactId}, or ${baseArtifactName}`,
    );
    return [];
  }

  /**
   * Get beans that support a specific Camel component
   * @param componentName - The Camel component name (e.g., "camel-langchain4j-agent")
   */
  static getBeansByComponent(componentName: string) {
    const allBeans = this.getAllBeans();
    return allBeans.filter((bean) => bean.components.includes(componentName));
  }

  /**
   * Get factories that support a specific Camel component
   * @param componentName - The Camel component name (e.g., "camel-langchain4j-agent")
   */
  static getFactoriesByComponent(componentName: string) {
    const allFactories = this.getAllFactories();
    return allFactories.filter((factory) => factory.components.includes(componentName));
  }

  /**
   * Get dependant beans for factories that match a specific bean
   * Dependant beans are beans that are generated based on factory configuration
   * @param beanName - The bean name to search for
   * @returns Array of dependant beans from matching factories
   */
  static getDependantBeansForBean(beanName: string) {
    if (!this.catalog) return [];

    // Find the bean and its supported components
    const bean = this.getBeanByName(beanName);
    if (!bean) return [];

    // Find the component that contains this bean
    const beanComponent = this.catalog.components.find((comp) => comp.beans.some((b) => b.name === beanName));

    if (!beanComponent) return [];

    const dependantBeans: Array<{
      bean: import('../models/forage-components-catalog').DependantBean;
      factoryType: string;
      artifactId: string;
      groupId: string;
      version: string;
    }> = [];

    // Get the base artifact name to search for related components
    const baseArtifactName = this.getBaseArtifactName(beanComponent.artifactId);
    const commonArtifactId = `${baseArtifactName}-common`;

    // Collect dependant beans from:
    // 1. The component containing the bean
    // 2. The -common variant (e.g., forage-jdbc-common)
    // 3. The base component (e.g., forage-jdbc)
    const componentsToCheck = [
      beanComponent,
      this.catalog.components.find((comp) => comp.artifactId === commonArtifactId),
      this.catalog.components.find((comp) => comp.artifactId === baseArtifactName),
    ].filter(Boolean);

    componentsToCheck.forEach((component) => {
      if (!component) return;

      // Add component-level dependant beans
      component.dependantBeans?.forEach((depBean) => {
        dependantBeans.push({
          bean: depBean,
          factoryType: depBean.dependsOnFactoryType,
          artifactId: component.artifactId,
          groupId: component.groupId,
          version: component.version,
        });
      });

      // Also check factory-level dependant beans
      component.factories.forEach((factory) => {
        factory.runtimes?.forEach((runtime) => {
          runtime.dependantBeans?.forEach((depBean) => {
            dependantBeans.push({
              bean: depBean,
              factoryType: factory.factoryType,
              artifactId: runtime.artifactId,
              groupId: runtime.groupId,
              version: runtime.version,
            });
          });
        });
      });
    });

    return dependantBeans;
  }

  /**
   * Clear the loaded catalog (useful for testing)
   */
  static clearCatalog(): void {
    this.catalog = null;
    this.catalogPath = '';
  }
}
