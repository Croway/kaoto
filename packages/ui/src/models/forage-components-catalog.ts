/**
 * TypeScript interfaces for Forage Catalog JSON schema
 * Generated from: /Users/fmariani/Repositories/croway/camel-forage/forage-catalog/target/classes/catalog/forage-catalog.json
 */

/**
 * Configuration property definition for a component
 */
export interface ConfigurationProperty {
  /** Property name (e.g., "multi.agent.names") */
  name: string;
  /** Property type (e.g., "String", "Integer", "Boolean") */
  type: string;
  /** Description of the property */
  description: string;
  /** Whether the property is required */
  required: boolean;
  /** Default value for the property */
  defaultValue: string | null;
  /** Example value for the property */
  example: string | null;
  /** Label for the property (optional) */
  label: string | null;
  /** Configuration tag for the property (optional) */
  configTag: string | null;
}

/**
 * Bean provider definition
 */
export interface Bean {
  /** Bean name identifier (e.g., "infinispan", "chroma", "redis") */
  name: string;
  /** List of Camel components this bean supports */
  components: string[];
  /** Human-readable description of the bean's purpose */
  description: string;
  /** Fully qualified class name of the bean provider */
  className: string;
  /** Feature identifier for the bean */
  feature: string;
}

/**
 * Factory definition for component factories
 */
export interface Factory {
  /** Factory name identifier */
  name: string;
  /** List of Camel components this factory supports */
  components: string[];
  /** Human-readable description of the factory's purpose */
  description: string;
  /** Bean type (e.g., "Agent", "javax.sql.DataSource") */
  beanType: string;
  /** Type of factory (e.g., "Agent", "DataSource") */
  factoryType: string;
  /** Fully qualified class name of the factory */
  className: string;
  /** Whether the factory is autowired */
  autowired: boolean;
  /** Runtime type (e.g., "main", "spring-boot") */
  runtimeType: string;
  /** Nested runtime-specific factory variants */
  runtimes: RuntimeComponent[];
}

/**
 * Runtime-specific component variant (e.g., Spring Boot, Quarkus)
 */
export interface RuntimeComponent {
  /** Maven artifact ID */
  artifactId: string;
  /** Maven group ID */
  groupId: string;
  /** Component version */
  version: string;
  /** List of configuration properties for this runtime */
  configurationProperties: ConfigurationProperty[];
  /** Capabilities (currently null in the schema) */
  capabilities: null;
  /** List of bean providers */
  beans: Bean[];
  /** List of factory definitions */
  factories: Factory[];
  /** Dependant beans that require this factory */
  dependantBeans: DependantBean[];
  /** Runtime type identifier */
  runtimeType: string;
}

/**
 * Dependant bean definition
 */
export interface DependantBean {
  /** Factory type this bean depends on */
  dependsOnFactoryType: string;
  /** Property name that enables this bean */
  dependsOnProperty: string;
  /** Human-readable description */
  description: string;
  /** List of named beans this provides */
  namedBeans: string[];
  /** Bean type */
  beanType: string;
  /** Property that defines the bean name */
  propertyBeanName: string;
  /** Fully qualified class name */
  className: string;
}

/**
 * Component definition containing configuration and beans
 */
export interface Component {
  /** Maven artifact ID */
  artifactId: string;
  /** Maven group ID */
  groupId: string;
  /** Component version */
  version: string;
  /** List of configuration properties for this component */
  configurationProperties: ConfigurationProperty[];
  /** Capabilities (currently null in the schema) */
  capabilities: null;
  /** List of bean providers */
  beans: Bean[];
  /** List of factory definitions */
  factories: Factory[];
  /** Dependant beans that require this component */
  dependantBeans: DependantBean[];
  /** Runtime type (e.g., null, "spring-boot", "quarkus") */
  runtimeType: string | null;
}

/**
 * Root catalog structure
 */
export interface ForageCatalog {
  /** Catalog schema version */
  version: string;
  /** Tool that generated the catalog */
  generatedBy: string;
  /** Unix timestamp of catalog generation */
  timestamp: number;
  /** List of all components in the catalog */
  components: Component[];
}
