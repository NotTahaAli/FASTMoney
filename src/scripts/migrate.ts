import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { commitTransaction, executeQuery, rollbackTransaction, startTransaction } from '@/services/db.service';

const SCHEMA_DIR = path.resolve(__dirname, '../../schema');

interface MigrationVersion {
    Id: number;
    Version: string;
    AppliedOn: Date;
}

async function makeMigrationsTable() {
    await executeQuery(`
        IF NOT EXISTS (SELECT *
        FROM sys.schemas
        WHERE name = 'Migration')
        BEGIN
            EXEC('CREATE SCHEMA Migration');
        END
        
        IF NOT EXISTS (SELECT *
        FROM sys.tables
        WHERE name = 'Versions' AND schema_id = SCHEMA_ID('Migration'))
        BEGIN
            CREATE TABLE Migration.Versions
            (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Version VARCHAR(255) NOT NULL,
                AppliedOn DATETIME NOT NULL DEFAULT GETDATE()
            );
        END`);
}

async function getDBName(): Promise<string[]> {
    return (await executeQuery<{DBName: string}[]>(`
        SELECT DB_NAME() AS DBName
    `)).map(db => db.DBName);
}

/**
 * Get a list of all schema files in the schema directory
 * @returns {Promise<string[]>} List of schema files
 */
async function getSchemaFiles(): Promise<string[]> {
    try {
        const files = await fs.promises.readdir(SCHEMA_DIR);
        return files
            .filter(file => file.startsWith('schema_') && file.endsWith('.sql'))
            .sort((a, b) => {
                // Extract version numbers for sorting (schema_001.sql -> 001)
                const versionA = a.match(/schema_(\d+)\.sql/)?.[1] || '';
                const versionB = b.match(/schema_(\d+)\.sql/)?.[1] || '';
                return versionA.localeCompare(versionB);
            });
    } catch (error) {
        console.error('Error reading schema directory:', error);
        throw error;
    }
}

/**
 * Get a list of all migrations that have already been applied
 * @returns {Promise<string[]>} List of applied migration versions
 */
async function getAppliedMigrations(): Promise<string[]> {
    // First check if the database exists and has the Migrations table
    try {
        const versions = await executeQuery<MigrationVersion[]>(`
            SELECT Id, Version, AppliedOn 
            FROM Migration.Versions 
            ORDER BY Id ASC
        `);
        return versions.map(v => v.Version);
    } catch {
        await makeMigrationsTable();
        return [];
    }
}

/**
 * Apply a single migration
 * @param {string} filename The name of the migration file
 * @returns {Promise<boolean>} True if the migration was applied successfully, false otherwise
 */
async function applyMigration(filename: string, appliedMigrations: string[]): Promise<boolean> {
    try {
        const filePath = path.join(SCHEMA_DIR, filename);
        const sql = await fs.promises.readFile(filePath, 'utf8');

        const version = filename.match(/schema_(\d+)\.sql/)?.[1];
        if (!version) {
            console.error(`Invalid migration filename: ${filename}`);
            return false;
        }
        if (appliedMigrations.includes(version)) {
            console.log(`Migration ${filename} has already been applied`);
            return true;
        }

        console.log(`Applying migration ${filename}...`);


        const batches = sql.split(/[;\n]\s*GO\s*[\r\n]+/);
        const tx = await startTransaction();
        let batchCount = 0;
        try {
            for (let batch of batches) {
                if (batch.trim()) {
                    if (batch.endsWith('GO')) {
                        // Remove the trailing 'GO' if present
                        batch = batch.replace(/\s*GO\s*$/i, '').trim();
                    }
                    // Execute each batch of SQL commands
                    await executeQuery(batch, {}, tx);
                    console.log(`Executed batch: ${++batchCount} of ${batches.length}, in ${filename}`);
                }
            }
            // Insert migration version into the database
            await executeQuery(`
                INSERT INTO Migration.Versions (Version)
                VALUES (@version)
            `, { version }, tx);
            console.log(`Inserted migration version ${version} into database`);
            appliedMigrations.push(version);
        } catch (error) {
            await rollbackTransaction(tx);
            throw error;
        }
        await commitTransaction(tx);

        console.log(`Migration ${filename} applied successfully`);
        return true;
    } catch (error) {
        console.error(`Error applying migration ${filename}:`, error);
        return false;
    }
}

/**
 * Run all pending migrations
 */
async function runMigrations(): Promise<void> {
    try {
        // Ensure Database is not master
        if ((await getDBName())[0]?.toLowerCase() === 'master') {
            console.error('Cannot run migrations on master database');
            process.exit(1);
        }

        const schemaFiles = await getSchemaFiles();
        console.log(`Found ${schemaFiles.length} schema files`);

        const appliedMigrations = await getAppliedMigrations();
        console.log(`Found ${appliedMigrations.length} already applied migrations`);

        // Filter out migrations that have already been applied
        const pendingMigrations = schemaFiles.filter(file => {
            const version = file.match(/schema_(\d+)\.sql/)?.[1];
            return version && !appliedMigrations.includes(version);
        });

        if (pendingMigrations.length === 0) {
            console.log('No pending migrations to apply');
            return;
        }

        console.log(`Applying ${pendingMigrations.length} pending migrations...`);

        // Apply migrations in sequence
        for (const migration of pendingMigrations) {
            const success = await applyMigration(migration, appliedMigrations);
            if (!success) {
                console.error(`Migration failed: ${migration}`);
                process.exit(1);
            }
        }

        console.log('All migrations applied successfully');
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

// Run migrations when script is executed directly
if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Unhandled migration error:', error);
            process.exit(1);
        });
}
