import { DataSource } from 'typeorm';
import { getTenantConnectionConfig } from '../../tenant-orm.config';

// Shared connection pool to reuse connections across modules
export const connections = new Map<string, DataSource>();

export async function getTenantConnection(
  tenantSlug: string,
): Promise<DataSource> {
  // Check if connection already exists
  if (connections.has(tenantSlug)) {
    const existingConnection = connections.get(tenantSlug);
    if (existingConnection?.isInitialized) {
      return existingConnection;
    }
  }

  // Create new connection
  const config = getTenantConnectionConfig(tenantSlug);
  const connection = new DataSource(config);

  if (!connection.isInitialized) {
    await connection.initialize();
  }

  connections.set(tenantSlug, connection);
  return connection;
}

export async function closeAllConnections(): Promise<void> {
  for (const [tenantSlug, connection] of connections.entries()) {
    if (connection.isInitialized) {
      await connection.destroy();
    }
    connections.delete(tenantSlug);
  }
}
