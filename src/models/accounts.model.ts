import db from '@/services/db.service';
import { customValidators, validateObject } from '@/utils/validator.util';
import { StatusError } from '@/middleware/errorHandler.middleware';

export interface IAccountSQL {
    Id: string;
    UserId: number;
    Name: string;
    Balance: number;
    CreatedOn: Date;
}
export interface IAccount extends Omit<IAccountSQL, 'Id'> {
    Id: number;
}
export interface INewAccount {
    name: string;
    initialBalance?: number;
}

export interface IEditAccount {
    name: string;
}

export class Account {
    /**
     * Create a new account for a user
     * @param userId The user ID who owns the account
     * @param accountData Account creation data
     * @returns Newly created account
     */
    public static async createAccount(userId: number, accountData: INewAccount): Promise<IAccount> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            ...accountData
        }, {
            userId: customValidators.id,
            name: customValidators.nonEmptyString,
            initialBalance: customValidators.decimal.optional()
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, name, initialBalance = 0 } = validatedDataOrErrors;

        const query = `
            INSERT INTO Finance.Accounts (UserId, Name, Balance)
            OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.Name, INSERTED.Balance, INSERTED.CreatedOn
            VALUES (@userId, @name, @balance)
        `;

        const result = await db.executeQuery<IAccountSQL[]>(query, {
            userId: validUserId,
            name,
            balance: initialBalance
        });

        /*TODO:
            Make a transaction for the initial balance.
        */

        if (!result || result.length === 0) {
            throw new StatusError('Failed to create account');
        }

        return {
            ...result[0],
            Id: parseInt(result[0].Id)
        };
    }

    /**
     * Get all accounts for a specific user
     * @param userId The user ID to retrieve accounts for
     * @returns Array of user accounts
     */
    public static async getUserAccounts(userId: number): Promise<IAccount[]> {
        const [success, validatedDataOrErrors] = validateObject({ userId }, {
            userId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId } = validatedDataOrErrors;

        const query = `
            SELECT Id, UserId, Name, Balance, CreatedOn
            FROM Finance.Accounts
            WHERE UserId = @userId
            ORDER BY CreatedOn DESC
        `;

        const result = await db.executeQuery<IAccountSQL[]>(query, { userId: validUserId });

        return result.map((acc)=>{
            return {
                ...acc,
                Id: parseInt(acc.Id)
            };
        }) || [];
    }

    /**
     * Edit an existing account
     * @param userId The user ID who owns the account
     * @param accountId The account ID to edit
     * @param accountData Updated account data
     * @returns Updated account
     */
    public static async editAccount(userId: number, accountId: number, accountData: IEditAccount): Promise<IAccount> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            accountId,
            ...accountData
        }, {
            userId: customValidators.id,
            accountId: customValidators.id,
            name: customValidators.nonEmptyString
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, accountId: validAccountId, name } = validatedDataOrErrors;

        // First check if this account belongs to the user
        const accountExists = await this.verifyAccountOwnership(validUserId, validAccountId);
        if (!accountExists) {
            throw new StatusError('Account not found or does not belong to user', 404);
        }

        const query = `
            UPDATE Finance.Accounts
            SET Name = @name
            OUTPUT INSERTED.Id, INSERTED.UserId, INSERTED.Name, INSERTED.Balance, INSERTED.CreatedOn
            WHERE Id = @accountId AND UserId = @userId
        `;

        const result = await db.executeQuery<IAccountSQL[]>(query, {
            userId: validUserId,
            accountId: validAccountId,
            name
        });

        if (!result || result.length === 0) {
            throw new StatusError('Failed to update account');
        }

        return {
            ...result[0],
            Id: parseInt(result[0].Id)
        };
    }

    /**
     * Delete an existing account
     * @param userId The user ID who owns the account
     * @param accountId The account ID to delete
     * @returns True if deletion was successful
     */
    public static async deleteAccount(userId: number, accountId: number) {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            accountId
        }, {
            userId: customValidators.id,
            accountId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, accountId: validAccountId } = validatedDataOrErrors;

        // First check if this account belongs to the user
        const accountExists = await this.verifyAccountOwnership(validUserId, validAccountId);
        if (!accountExists) {
            throw new StatusError('Account not found or does not belong to user', 404);
        }

        const query = `
            DELETE FROM Finance.Accounts
            WHERE Id = @accountId AND UserId = @userId
        `;

        await db.executeQuery(query, {
            userId: validUserId,
            accountId: validAccountId
        });
    }

    /**
     * Get account details by ID
     * @param userId The user ID who owns the account
     * @param accountId The account ID to retrieve
     * @returns Account details or null if not found
     */
    public static async getAccountById(accountId: number): Promise<IAccount | null> {
        const [success, validatedDataOrErrors] = validateObject({
            accountId
        }, {
            accountId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { accountId: validAccountId } = validatedDataOrErrors;

        const query = `
            SELECT Id, UserId, Name, Balance, CreatedOn
            FROM Finance.Accounts
            WHERE Id = @accountId
        `;

        const result = await db.executeQuery<IAccountSQL[]>(query, {
            accountId: validAccountId
        });

        if (!result || result.length === 0) {
            return null;
        }

        return {
            ...result[0],
            Id: parseInt(result[0].Id)
        };
    }

    /**
     * Verify if an account belongs to a specific user
     * @param userId The user ID to check ownership against
     * @param accountId The account ID to verify
     * @returns True if the account belongs to the user, false otherwise
     */
    private static async verifyAccountOwnership(userId: number, accountId: number): Promise<boolean> {
        const query = `
            SELECT COUNT(*) as count
            FROM Finance.Accounts
            WHERE Id = @accountId AND UserId = @userId
        `;

        const result = await db.executeQuery<{count: number}[]>(query, {
            userId,
            accountId
        });

        return result[0].count > 0;
    }
}
