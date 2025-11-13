import { FunctionComponent, PropsWithChildren, createContext, useContext } from 'react';
import { ForageCatalogService } from '../services/forage-catalog.service';

/**
 * Context to provide access to ForageCatalogService throughout the application
 */
export const ForageCatalogContext = createContext<typeof ForageCatalogService>(ForageCatalogService);

/**
 * Provider for Forage catalog context
 * The catalog is loaded during app startup via CatalogLoaderProvider
 * This provider simply exposes the ForageCatalogService to React components
 */
export const ForageCatalogProvider: FunctionComponent<PropsWithChildren> = (props) => {
  return <ForageCatalogContext.Provider value={ForageCatalogService}>{props.children}</ForageCatalogContext.Provider>;
};

/**
 * Hook to access the Forage catalog service in React components
 * @example
 * const forageCatalog = useForageCatalog();
 * const catalog = forageCatalog.getCatalog();
 * const beans = forageCatalog.getAllBeans();
 */
export const useForageCatalog = () => {
  const context = useContext(ForageCatalogContext);
  if (!context) {
    throw new Error('useForageCatalog must be used within a ForageCatalogProvider');
  }
  return context;
};
