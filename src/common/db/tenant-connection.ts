import { DataSource } from 'typeorm';
import { getTenantConnectionConfig } from '../../tenant-orm.config';

/**
 * In-memory connection pool for tenant schemas.
 * - One DataSource per schema, reused across requests
 * - Init lock per schema avoids duplicate connections under concurrent load
 */
const connections = new Map<string, DataSource>();
const initPromises = new Map<string, Promise<DataSource>>();

export async function getTenantConnection(
  schema: string = 'public',
): Promise<DataSource> {
  const existing = connections.get(schema);
  if (existing?.isInitialized) return existing;

  let initPromise = initPromises.get(schema);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const config = getTenantConnectionConfig(schema);
        const connection = new DataSource(config);
        await connection.initialize();
        connections.set(schema, connection);
        return connection;
      } finally {
        initPromises.delete(schema);
      }
    })();
    initPromises.set(schema, initPromise);
  }

  return initPromise;
}

export async function closeAllTenantConnections(): Promise<void> {
  initPromises.clear();
  for (const [schema, connection] of connections.entries()) {
    try {
      if (connection.isInitialized) {
        await connection.destroy();
      }
    } finally {
      connections.delete(schema);
    }
  }
}
