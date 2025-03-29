import sql, { Transaction } from 'mssql';

const connectionString: string | undefined = process.env.DB_CONNECTION_STRING;
if (process.env.SKIP_DB === 'true') {
    console.log('SKIP_DB is set to true, skipping database connection');
    process.exit(0);
}
if (!connectionString) {
  throw new Error('DB_CONNECTION_STRING is not set');
}

// Create a connection pool
const pool = new sql.ConnectionPool(connectionString);
const poolConnect = pool.connect();

// Handle connection errors
pool.on('error', err => {
  console.error('SQL Server connection error:', err);
});

/**
 * Execute a SQL query
 * @param query The SQL query to execute
 * @param params Optional parameters for the query
 * @returns Query result
 */
export async function executeQuery<T>(query: string, params: Record<string, unknown> = {}, transaction?: Transaction): Promise<T> {
  try {
    if (!transaction) await poolConnect;
    const request = (transaction || pool).request();
    
    // Add parameters to the request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    
    const result = await request.query(query);
    return result.recordset as T;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a stored procedure
 * @param procedureName The stored procedure name
 * @param params Optional parameters for the stored procedure
 * @returns Stored procedure result
 */
export async function executeStoredProcedure<T>(procedureName: string, params: Record<string, unknown> = {}, transaction?: Transaction): Promise<T> {
  try {
    if (!transaction) await poolConnect;
    const request = (transaction || pool).request();
    
    // Add parameters to the request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    
    const result = await request.execute(procedureName);
    return result.recordset as T;
  } catch (error) {
    console.error('Stored procedure error:', error);
    throw error;
  }
}

/**
 * Start a transaction
 * @returns Transaction object
 */
export async function startTransaction(): Promise<Transaction> {
  await poolConnect;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  return transaction;
}

/**
 * Commit a transaction
 * @param transaction The transaction to commit
 */
export async function commitTransaction(transaction: Transaction): Promise<void> {
  try {
    await transaction.commit();
  } catch (error) {
    console.error('Transaction commit error:', error);
    throw error;
  }
}

/**
 * Rollback a transaction
 * @param transaction The transaction to rollback
 */
export async function rollbackTransaction(transaction: Transaction): Promise<void> {
  try {
    await transaction.rollback();
  } catch (error) {
    console.error('Transaction rollback error:', error);
    throw error;
  }
}

// Close pool on application termination
process.on('SIGINT', () => {
  pool.close();
  process.exit(0);
});

const db = {
    executeQuery,
    executeStoredProcedure,
    startTransaction,
    commitTransaction,
    rollbackTransaction
}

export default db;

