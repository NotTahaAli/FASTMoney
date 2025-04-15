import db, { commitTransaction, rollbackTransaction, startTransaction } from '@/services/db.service';
import { StatusError } from '@/middleware/errorHandler.middleware';
import { customValidators, validateObject } from '@/utils/validator.util';
import { Account } from './accounts.model';
import { z } from 'zod';
import { Friend } from './friends.model';

// SQL result interfaces (raw DB results)
export interface ITransactionSQL {
    Id: string;
    Category: string;
    IsIncome: boolean;
    IncludeInReports: boolean;
    Description: string | null;
    Notes: string | null;
    CreatedOn: Date;
}

export interface ITransactionAmountSQL {
    Id: string;
    TransactionId: string;
    AccountId: string | null;
    AccountName: string | null;
    AmountToPay: number;
    AmountPaid: number;
    CreatedOn: Date;
}

export interface ITransactionTagSQL {
    Id: string;
    TransactionId: string;
    Tag: string;
    CreatedOn: Date;
}

// Client-facing interfaces
export interface ITransaction {
    id: number;
    category: string;
    isIncome: boolean;
    includeInReports: boolean;
    description: string | null;
    notes: string | null;
    createdOn: Date;
    amounts: ITransactionAmount[];
    tags?: ITransactionTag[];
}

export interface ITransactionAmount {
    id: number;
    transactionId: number;
    accountId: number | null;
    accountName: string | null;
    amountToPay: number;
    amountPaid: number;
    createdOn: Date;
}

export interface ITransactionTag {
    id: number;
    transactionId: number;
    tag: string;
    createdOn: Date;
}

// Input interfaces
export interface INewTransaction {
    category: string;
    isIncome: boolean;
    includeInReports: boolean;
    description: string;
    notes?: string;
    amounts: INewTransactionAmount[];
    tags?: string[];
}

export interface INewTransactionAmount {
    accountId?: number;
    accountName?: string;
    amountToPay: number;
    amountPaid: number;
}

export interface IEditTransaction {
    category?: string;
    isIncome?: boolean;
    includeInReports?: boolean;
    description?: string;
    notes?: string;
    amounts?: IEditTransactionAmount[];
}

export interface IEditTransactionAmount {
    id?: number;
    accountId?: number;
    accountName?: string;
    amountToPay?: number;
    amountPaid?: number;
}

export interface ITransactionFilters {
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    category?: string;
    tags?: string[];
    accountId?: number;
}

export interface ITransactionList {
    page: number;
    limit: number;
    total: number;
    transactions: ITransaction[];
}

export interface INewTransactionTag {
    tag: string;
}

export class Transaction {
    /**
     * Create a new transaction
     * @param userId User ID creating the transaction
     * @param transaction Transaction data
     * @returns Created transaction with all details
     */
    public static async createTransaction(userId: number, transaction: INewTransaction): Promise<ITransaction> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            ...transaction
        }, {
            userId: customValidators.id,
            category: customValidators.nonEmptyString,
            isIncome: z.boolean().optional(),
            includeInReports: z.boolean().optional(),
            description: customValidators.nonEmptyString.optional(),
            notes: customValidators.nonEmptyString.optional(),
            amounts: z.array(z.object({
                accountId: customValidators.id.optional(),
                accountName: customValidators.nonEmptyString.optional(),
                amountToPay: customValidators.decimal.nonnegative(),
                amountPaid: customValidators.decimal.nonnegative()
            })).min(1),
            tags: z.array(customValidators.nonEmptyString).optional()
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const {
            category,
            isIncome,
            includeInReports,
            description,
            notes,
            amounts,
            tags 
        } = validatedDataOrErrors;

        // Validate each amount
        let hasSelfAmount = false;
        let sumOfAmountPaid = 0;
        let sumOfAmountToPay = 0;
        for (const amount of amounts) {
            // Either accountId or accountName must be provided
            if (!amount.accountId && !amount.accountName) {
                throw new StatusError('Either accountId or accountName must be provided for each amount');
            }

            // If accountId is provided, verify it exists and belongs to the user
            if (amount.accountId) {

                if (amount.accountName) {
                    throw new StatusError('Both accountId and accountName cannot be provided for the same amount');
                }
                const account = await Account.getAccountById(amount.accountId);
                if (!account) {
                    throw new StatusError(`Account with ID ${amount.accountId} not found`);
                }
                if (account.UserId == userId) {
                    hasSelfAmount = true;
                } else if (!(await Friend.isFriend(account.UserId, userId))) {
                    throw new StatusError(`You do not have access to account with ID ${amount.accountId}`);
                }
            }

            sumOfAmountPaid += amount.amountPaid;
            sumOfAmountToPay += amount.amountToPay;
        }
        const epsilon = 0.01; // Define a small tolerance value
        if (Math.abs(sumOfAmountPaid - sumOfAmountToPay) > epsilon) {
            throw new StatusError('Sum of Amount Paid must equal the sum of Amount To Pay');
        }
        if (!hasSelfAmount) {
            throw new StatusError('At least one amount must have accountId set to the userId');
        }

        // Start a transaction to ensure all operations are atomic
        const tx = await startTransaction();

        try {
            // Insert the transaction record
            const insertTransactionQuery = `
                DECLARE @output TABLE (
                    Id BIGINT,
                    Category NVARCHAR(255),
                    IsIncome BIT,
                    IncludeInReports BIT,
                    Description NVARCHAR(255),
                    Notes NVARCHAR(MAX),
                    CreatedOn DATETIMEOFFSET(5)
                );
                INSERT INTO Finance.Transactions (Category, IsIncome, IncludeInReports, Description, Notes)
                OUTPUT INSERTED.Id, INSERTED.Category, INSERTED.IsIncome, INSERTED.IncludeInReports, INSERTED.Description, INSERTED.Notes, INSERTED.CreatedOn INTO @output
                VALUES (@category, @isIncome, @includeInReports, @description, @notes);
                SELECT * FROM @output;
            `;

            const transactionResult = await db.executeQuery<ITransactionSQL[]>(insertTransactionQuery, {
                category,
                isIncome: isIncome ?? false,
                includeInReports: includeInReports ?? true,
                description: description ?? null,
                notes: notes ?? null
            }, tx);

            if (!transactionResult || transactionResult.length === 0) {
                throw new StatusError('Failed to create transaction');
            }

            const transactionId = parseInt(transactionResult[0].Id);
            const transactionAmounts: ITransactionAmount[] = [];

            // Insert each transaction amount
            for (const amount of amounts) {
                const insertAmountQuery = `
                    DECLARE @output TABLE (
                        Id BIGINT,
                        TransactionId BIGINT,
                        AccountId BIGINT,
                        AccountName NVARCHAR(255),
                        AmountToPay DECIMAL(19, 4),
                        AmountPaid DECIMAL(19, 4),
                        CreatedOn DATETIMEOFFSET(5)
                    );
                    INSERT INTO Finance.TransactionAmounts (TransactionId, AccountId, AccountName, AmountToPay, AmountPaid)
                    OUTPUT INSERTED.Id, INSERTED.TransactionId, INSERTED.AccountId, INSERTED.AccountName, INSERTED.AmountToPay, INSERTED.AmountPaid, INSERTED.CreatedOn INTO @output
                    VALUES (@transactionId, @accountId, @accountName, @amountToPay, @amountPaid);
                    SELECT * FROM @output;
                `;

                const amountResult = await db.executeQuery<ITransactionAmountSQL[]>(insertAmountQuery, {
                    transactionId,
                    accountId: amount.accountId || null,
                    accountName: amount.accountName || null,
                    amountToPay: amount.amountToPay,
                    amountPaid: amount.amountPaid
                }, tx);

                if (!amountResult || amountResult.length === 0) {
                    throw new StatusError('Failed to create transaction amount');
                }

                transactionAmounts.push({
                    id: parseInt(amountResult[0].Id),
                    transactionId,
                    accountId: amountResult[0].AccountId ? parseInt(amountResult[0].AccountId) : null,
                    accountName: amountResult[0].AccountName,
                    amountToPay: amountResult[0].AmountToPay,
                    amountPaid: amountResult[0].AmountPaid,
                    createdOn: amountResult[0].CreatedOn
                });
            }

            // Insert tags if provided
            const transactionTags: ITransactionTag[] = [];
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    const insertTagQuery = `
                        DECLARE @output TABLE (
                            Id BIGINT,
                            TransactionId BIGINT,
                            AccountId BIGINT,
                            AccountName NVARCHAR(255),
                            AmountToPay DECIMAL(19, 4),
                            AmountPaid DECIMAL(19, 4),
                            CreatedOn DATETIMEOFFSET(5)
                        );
                        INSERT INTO Finance.TransactionTags (TransactionId, Tag)
                        OUTPUT INSERTED.Id, INSERTED.TransactionId, INSERTED.Tag, INSERTED.CreatedOn INTO @output
                        VALUES (@transactionId, @tag);
                        SELECT * FROM @output;
                    `;

                    const tagResult = await db.executeQuery<ITransactionTagSQL[]>(insertTagQuery, {
                        transactionId,
                        tag
                    }, tx);

                    if (!tagResult || tagResult.length === 0) {
                        throw new StatusError('Failed to create transaction tag');
                    }

                    transactionTags.push({
                        id: parseInt(tagResult[0].Id),
                        transactionId,
                        tag: tagResult[0].Tag,
                        createdOn: tagResult[0].CreatedOn
                    });
                }
            }

            await commitTransaction(tx);

            // Return the completed transaction
            return {
                id: transactionId,
                category: transactionResult[0].Category,
                isIncome: transactionResult[0].IsIncome,
                includeInReports: transactionResult[0].IncludeInReports,
                description: transactionResult[0].Description,
                notes: transactionResult[0].Notes,
                createdOn: transactionResult[0].CreatedOn,
                amounts: transactionAmounts,
                tags: transactionTags
            };
        } catch (error) {
            await rollbackTransaction(tx);
            throw error;
        }
    }

    private static async hasAccessToTransaction(userId: number, transactionId: number): Promise<boolean> {
        // First, verify if the user has access to this transaction via their accounts
        const hasAccessQuery = `
            SELECT COUNT(*) as count
            FROM Finance.TransactionAmounts ta
            JOIN Finance.Accounts a ON ta.AccountId = a.Id
            WHERE ta.TransactionId = @transactionId AND a.UserId = @userId
        `;

        const accessResult = await db.executeQuery<{ count: number }[]>(hasAccessQuery, {
            transactionId,
            userId
        });

        if (accessResult[0].count === 0) {
            return false; // User doesn't have access or transaction doesn't exist
        }
        return true;
    }

    /**
     * Get a transaction by ID
     * @param userId User ID requesting the transaction
     * @param transactionId Transaction ID to retrieve
     * @returns Transaction details or null if not found
     */
    public static async getTransactionById(userId: number, transactionId: number): Promise<ITransaction | null> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            transactionId
        }, {
            userId: customValidators.id,
            transactionId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, transactionId: validTransactionId } = validatedDataOrErrors;

        if (!await this.hasAccessToTransaction(validUserId, validTransactionId)) {
            throw new StatusError('Transaction not found or you do not have access to it', 404);
        }

        // Get transaction details
        const transactionQuery = `
            SELECT Id, Category, IsIncome, IncludeInReports, Description, Notes, CreatedOn
            FROM Finance.Transactions
            WHERE Id = @transactionId
        `;

        const transactionResult = await db.executeQuery<ITransactionSQL[]>(transactionQuery, {
            transactionId: validTransactionId
        });

        if (!transactionResult || transactionResult.length === 0) {
            return null;
        }

        // Get transaction amounts
        const amountsQuery = `
            SELECT Id, TransactionId, AccountId, AccountName, AmountToPay, AmountPaid, CreatedOn
            FROM Finance.TransactionAmounts
            WHERE TransactionId = @transactionId
        `;

        const amountsResult = await db.executeQuery<ITransactionAmountSQL[]>(amountsQuery, {
            transactionId: validTransactionId
        });

        // Get transaction tags
        const tagsQuery = `
            SELECT Id, TransactionId, Tag, CreatedOn
            FROM Finance.TransactionTags
            WHERE TransactionId = @transactionId
        `;

        const tagsResult = await db.executeQuery<ITransactionTagSQL[]>(tagsQuery, {
            transactionId: validTransactionId
        });

        // Map results to client format
        const transaction: ITransaction = {
            id: parseInt(transactionResult[0].Id),
            category: transactionResult[0].Category,
            isIncome: transactionResult[0].IsIncome,
            includeInReports: transactionResult[0].IncludeInReports,
            description: transactionResult[0].Description,
            notes: transactionResult[0].Notes,
            createdOn: transactionResult[0].CreatedOn,
            amounts: amountsResult.map(amount => ({
                id: parseInt(amount.Id),
                transactionId: parseInt(amount.TransactionId),
                accountId: amount.AccountId ? parseInt(amount.AccountId) : null,
                accountName: amount.AccountName,
                amountToPay: amount.AmountToPay,
                amountPaid: amount.AmountPaid,
                createdOn: amount.CreatedOn
            })),
            tags: tagsResult.map(tag => ({
                id: parseInt(tag.Id),
                transactionId: parseInt(tag.TransactionId),
                tag: tag.Tag,
                createdOn: tag.CreatedOn
            }))
        };

        return transaction;
    }

    /**
     * Edit an existing transaction
     * @param userId User ID editing the transaction
     * @param transactionId Transaction ID to edit
     * @param updates Transaction updates
     * @param amountUpdates Optional amount updates
     * @returns Updated transaction
     */
    public static async updateTransaction(
        userId: number, 
        transactionId: number, 
        updates: IEditTransaction
    ): Promise<ITransaction | null> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            transactionId,
            ...updates
        }, {
            userId: customValidators.id,
            transactionId: customValidators.id,
            category: customValidators.nonEmptyString.optional(),
            isIncome: z.boolean().optional(),
            includeInReports: z.boolean().optional(),
            description: customValidators.nonEmptyString.optional(),
            notes: customValidators.nonEmptyString.optional()
        });

        const amountUpdates = updates.amounts;

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { 
            userId: validUserId,
            transactionId: validTransactionId,
            ...validUpdates 
        } = validatedDataOrErrors;

        // Check if transaction exists and user has access to it
        const transaction = await this.getTransactionById(validUserId, validTransactionId);
        if (!transaction) {
            throw new StatusError('Transaction not found or you do not have access to it', 404);
        }

        // Start a transaction
        const tx = await startTransaction();

        try {
            // Update transaction details
            if (Object.keys(validUpdates).length > 0) {
                // Build the update query dynamically based on provided fields
                const updateFields = [];
                const params: {
                    transactionId: number;
                    category?: string;
                    isIncome?: boolean;
                    includeInReports?: boolean;
                    description?: string;
                    notes?: string | null;
                } = {
                    transactionId: validTransactionId
                };

                if (validUpdates.category) {
                    updateFields.push('Category = @category');
                    params.category = validUpdates.category;
                }

                if (validUpdates.isIncome !== undefined) {
                    updateFields.push('IsIncome = @isIncome');
                    params.isIncome = validUpdates.isIncome;
                }

                if (validUpdates.includeInReports !== undefined) {
                    updateFields.push('IncludeInReports = @includeInReports');
                    params.includeInReports = validUpdates.includeInReports;
                }

                if (validUpdates.description) {
                    updateFields.push('Description = @description');
                    params.description = validUpdates.description;
                }

                if (validUpdates.notes !== undefined) {
                    updateFields.push('Notes = @notes');
                    params.notes = validUpdates.notes || null;
                }

                if (updateFields.length > 0) {
                    const updateQuery = `
                        UPDATE Finance.Transactions
                        SET ${updateFields.join(', ')}
                        WHERE Id = @transactionId
                    `;

                    await db.executeQuery(updateQuery, params, tx);
                }
            }

            let deleted = false;
            // Update transaction amounts if provided
            if (amountUpdates) {
                // Check which amounts to remove
                const amountsToRemove = transaction.amounts.filter(a => !amountUpdates.some(u => u.id === a.id));
                for (const amount of amountsToRemove) {
                    // Delete the amount
                    const deleteAmountQuery = `
                        DELETE FROM Finance.TransactionAmounts
                        WHERE Id = @amountId
                    `;

                    await db.executeQuery(deleteAmountQuery, {
                        amountId: amount.id
                    }, tx);

                    transaction.amounts = transaction.amounts.filter(a => a.id !== amount.id);
                }

                for (const update of amountUpdates) {
                    // Validate amount update
                    const [amtSuccess, validatedAmtOrErrors] = validateObject(update, {
                        id: customValidators.id.optional(),
                        accountId: customValidators.id.optional(),
                        accountName: customValidators.nonEmptyString.optional(),
                        amountToPay: customValidators.decimal.nonnegative().optional(),
                        amountPaid: customValidators.decimal.nonnegative().optional()
                    });

                    if (!amtSuccess) {
                        const error = validatedAmtOrErrors.errors[0];
                        throw new StatusError(`Amount update ${error.path.join(".")}: ${error.message}`);
                    }

                    if (!update.id) {
                        if (!validatedAmtOrErrors.accountId && !validatedAmtOrErrors.accountName) {
                            throw new StatusError('Either accountId or accountName must be provided for each amount update');
                        }
                        if (validatedAmtOrErrors.accountId && validatedAmtOrErrors.accountName) {
                            throw new StatusError('Both accountId and accountName cannot be provided for the same amount update');
                        }
                        if (validatedAmtOrErrors.accountId) {
                            const account = await Account.getAccountById(validatedAmtOrErrors.accountId);
                            if (!account) {
                                throw new StatusError(`Account with ID ${validatedAmtOrErrors.accountId} not found`);
                            }
                            if (account.UserId !== userId && !(await Friend.isFriend(account.UserId, userId))) {
                                throw new StatusError(`You do not have access to account with ID ${validatedAmtOrErrors.accountId}`);
                            }
                        }

                        if (!validatedAmtOrErrors.amountPaid) {
                            throw new StatusError('Amount paid must be provided for each new amount');
                        }
                        if (!validatedAmtOrErrors.amountToPay) {
                            throw new StatusError('Amount to pay must be provided for each new amount');
                        }

                        // Insert new amount
                        const insertAmountQuery = `
                        
                            INSERT INTO Finance.TransactionAmounts (TransactionId, AccountId, AccountName, AmountToPay, AmountPaid)
                            OUTPUT INSERTED.Id, INSERTED.TransactionId, INSERTED.AccountId, INSERTED.AccountName, INSERTED.AmountToPay, INSERTED.AmountPaid, INSERTED.CreatedOn
                            VALUES (@transactionId, @accountId, @accountName, @amountToPay, @amountPaid)
                        `;
                        const amountResult = await db.executeQuery<ITransactionAmountSQL[]>(insertAmountQuery, {
                            transactionId: validTransactionId,
                            accountId: validatedAmtOrErrors.accountId || null,
                            accountName: validatedAmtOrErrors.accountName || null,
                            amountToPay: validatedAmtOrErrors.amountToPay,
                            amountPaid: validatedAmtOrErrors.amountPaid
                        }, tx);
                        if (!amountResult || amountResult.length === 0) {
                            throw new StatusError('Failed to create transaction amount');
                        }
                        transaction.amounts.push({
                            id: parseInt(amountResult[0].Id),
                            transactionId: parseInt(amountResult[0].TransactionId),
                            accountId: amountResult[0].AccountId ? parseInt(amountResult[0].AccountId) : null,
                            accountName: amountResult[0].AccountName,
                            amountToPay: amountResult[0].AmountToPay,
                            amountPaid: amountResult[0].AmountPaid,
                            createdOn: amountResult[0].CreatedOn
                        });
                    } else {
                        // Check if amount belongs to this transaction
                        const amount = transaction.amounts.find(a => a.id === update.id);
                        if (!amount) {
                            throw new StatusError(`Transaction amount with ID ${update.id} not found or doesn't belong to this transaction`);
                        }
    
                        // Build update fields
                        const updateAmountFields = [];
                        const amountParams: {
                            amountId: number;
                            transactionId: number;
                            accountId?: number;
                            accountName?: string;
                            amountToPay?: number;
                            amountPaid?: number;
                        } = {
                            amountId: update.id,
                            transactionId: validTransactionId
                        };
                        if (validatedAmtOrErrors.accountId && validatedAmtOrErrors.accountName) {
                            throw new StatusError('Both accountId and accountName cannot be provided for the same amount update');
                        }
                        if (validatedAmtOrErrors.accountId) {
                            const account = await Account.getAccountById(validatedAmtOrErrors.accountId);
                            if (!account) {
                                throw new StatusError(`Account with ID ${validatedAmtOrErrors.accountId} not found`);
                            }
                            if (account.UserId !== userId && !(await Friend.isFriend(account.UserId, userId))) {
                                throw new StatusError(`You do not have access to account with ID ${validatedAmtOrErrors.accountId}`);
                            }
                            updateAmountFields.push('AccountId = @accountId');
                            amountParams.accountId = validatedAmtOrErrors.accountId;
                        }
                        if (validatedAmtOrErrors.accountName) {
                            updateAmountFields.push('AccountName = @accountName');
                            amountParams.accountName = validatedAmtOrErrors.accountName;
                        }

                        if (update.amountToPay !== undefined) {
                            if (update.amountToPay < 0) {
                                throw new StatusError('Amount to pay must be greater than or equal to 0');
                            }
                            updateAmountFields.push('AmountToPay = @amountToPay');
                            amountParams.amountToPay = update.amountToPay;
                        }
    
                        if (update.amountPaid !== undefined) {
                            if (update.amountPaid < 0) {
                                throw new StatusError('Amount paid must be greater than or equal to 0');
                            }
                            
                            // Get current amount paid to calculate balance change
                            const oldAmountPaid = amount.amountPaid;
                            const amountPaidDiff = update.amountPaid - oldAmountPaid;
                            
                            updateAmountFields.push('AmountPaid = @amountPaid');
                            amountParams.amountPaid = update.amountPaid;
                            
                            // Update account balance if applicable
                            if (amount.accountId && amountPaidDiff !== 0) {
                                const balanceChange = transaction.isIncome ? amountPaidDiff : -amountPaidDiff;
                                
                                const updateBalanceQuery = `
                                    UPDATE Finance.Accounts
                                    SET Balance = Balance + @balanceChange
                                    WHERE Id = @accountId
                                `;
                                
                                await db.executeQuery(updateBalanceQuery, {
                                    accountId: amount.accountId,
                                    balanceChange
                                }, tx);
                            }
                        }
    
                        if (updateAmountFields.length > 0) {
                            const updateAmountQuery = `
                                UPDATE Finance.TransactionAmounts
                                SET ${updateAmountFields.join(', ')}
                                WHERE Id = @amountId AND TransactionId = @transactionId
                            `;
    
                            await db.executeQuery(updateAmountQuery, amountParams, tx);
                        }
                    }
                }
                if (transaction.amounts.length === 0) {
                    if (Object.keys(validUpdates).length > 0) {
                        throw new StatusError('Transaction cannot be deleted if it has updates');
                    }
                    // Delete the transaction if no amounts left
                    const deleteTransactionQuery = `
                        DELETE FROM Finance.Transactions
                        WHERE Id = @transactionId
                    `;
                    await db.executeQuery(deleteTransactionQuery, {
                        transactionId: validTransactionId
                    }, tx);
                    deleted = true;
                } else {
                    let isIdAmount = false;
                    let sumOfAmountPaid = 0;
                    let sumOfAmountToPay = 0;
                    for (const amount of transaction.amounts) {
                        if (amount.accountId) {
                            isIdAmount = true;
                        }
                        sumOfAmountPaid += amount.amountPaid;
                        sumOfAmountToPay += amount.amountToPay;
                    }
                    const epsilon = 0.01; // Define a small tolerance value
                    if (Math.abs(sumOfAmountPaid - sumOfAmountToPay) > epsilon) {
                        throw new StatusError('Sum of Amount Paid must equal the sum of Amount To Pay');
                    }
                    if (!isIdAmount) {
                        throw new StatusError('At least one amount must have accountId set');
                    }
                }
            }

            await commitTransaction(tx);

            if (deleted) {
                return null; // Transaction deleted
            }
            // Return the updated transaction
            return await this.getTransactionById(userId, validTransactionId) as ITransaction;
        } catch (error) {
            await rollbackTransaction(tx);
            throw error;
        }
    }

    /**
     * Get user transactions with filtering capabilities
     * @param userId User ID to get transactions for
     * @param filters Optional filtering criteria
     * @returns Paginated list of transactions
     */
    public static async getUserTransactions(userId: number, filters: ITransactionFilters = {}): Promise<ITransactionList> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            ...filters
        }, {
            userId: customValidators.id,
            page: z.number().int().positive().optional(),
            limit: z.number().int().positive().optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
            category: customValidators.nonEmptyString.optional(),
            tags: z.array(customValidators.nonEmptyString).optional(),
            accountId: customValidators.id.optional()
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const {
            userId: validUserId,
            page = 1,
            limit = 20,
            startDate,
            endDate,
            category,
            tags,
            accountId
        } = validatedDataOrErrors;

        // Build the query conditions
        const conditions = ['a.UserId = @userId'];
        const params: {
            userId: number;
            offset: number;
            limit: number;
            startDate?: Date;
            endDate?: Date;
            category?: string;
            accountId?: number;
            tagCount?: number;
        } = {
            userId: validUserId,
            offset: (page - 1) * limit,
            limit
        };
        const paramTags: {
            [key: string]: string;
        } = {};

        if (startDate) {
            conditions.push('t.CreatedOn >= @startDate');
            params.startDate = startDate;
        }

        if (endDate) {
            conditions.push('t.CreatedOn <= @endDate');
            params.endDate = endDate;
        }

        if (category) {
            conditions.push('t.Category = @category');
            params.category = category;
        }

        if (accountId) {
            conditions.push('ta.AccountId = @accountId');
            params.accountId = accountId;
        }

        // Build tag filter
        let tagJoin = '';
        if (tags && tags.length > 0) {
            tagJoin = `
                INNER JOIN (
                    SELECT DISTINCT TransactionId
                    FROM Finance.TransactionTags
                    WHERE Tag IN (${tags.map((_, i) => `@tag${i}`).join(', ')})
                    GROUP BY TransactionId
                    HAVING COUNT(DISTINCT Tag) = @tagCount
                ) as TagFilter ON t.Id = TagFilter.TransactionId
            `;
            
            // Add tag parameters
            tags.forEach((tag, i) => {
                paramTags[`tag${i}`] = tag;
            });
            params.tagCount = tags.length;
        }

        // Count total matching transactions
        const countQuery = `
            SELECT COUNT(DISTINCT t.Id) as total
            FROM Finance.Transactions t
            INNER JOIN Finance.TransactionAmounts ta ON t.Id = ta.TransactionId
            INNER JOIN Finance.Accounts a ON ta.AccountId = a.Id
            ${tagJoin}
            WHERE ${conditions.join(' AND ')}
        `;

        const countResult = await db.executeQuery<{ total: number }[]>(countQuery, {...params, ...paramTags});
        const total = countResult[0].total;

        // Get transactions with pagination
        const transactionsQuery = `
            SELECT DISTINCT t.Id, t.CreatedOn
            FROM Finance.Transactions t
            INNER JOIN Finance.TransactionAmounts ta ON t.Id = ta.TransactionId
            INNER JOIN Finance.Accounts a ON ta.AccountId = a.Id
            ${tagJoin}
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.CreatedOn DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `;

        const transactionsResult = await db.executeQuery<{Id: string}[]>(transactionsQuery, {...params, ...paramTags});

        // Get transaction details for each result
        const transactions: ITransaction[] = [];
        for (const trans of transactionsResult) {
            const transaction = await this.getTransactionById(validUserId, parseInt(trans.Id));
            if (transaction) {
                transactions.push(transaction);
            }
        }

        return {
            page,
            limit,
            total,
            transactions
        };
    }

    /**
     * Add a tag to a transaction
     * @param userId User ID making the request
     * @param transactionId Transaction ID to tag
     * @param tagData Tag data
     * @returns Created tag
     */
    public static async addTransactionTag(userId: number, transactionId: number, tagData: INewTransactionTag): Promise<ITransactionTag> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            transactionId,
            ...tagData
        }, {
            userId: customValidators.id,
            transactionId: customValidators.id,
            tag: customValidators.nonEmptyString
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, transactionId: validTransactionId, tag } = validatedDataOrErrors;

        // Check if transaction exists and user has access to it
        const transaction = await this.getTransactionById(validUserId, validTransactionId);
        if (!transaction) {
            throw new StatusError('Transaction not found or you do not have access to it', 404);
        }

        // Check if tag already exists
        if (transaction.tags && transaction.tags.some(t => t.tag.toLowerCase() === tag.toLowerCase())) {
            throw new StatusError(`Tag "${tag}" already exists for this transaction`, 400);
        }

        // Add the tag
        const insertTagQuery = `
            INSERT INTO Finance.TransactionTags (TransactionId, Tag)
            OUTPUT INSERTED.Id, INSERTED.TransactionId, INSERTED.Tag, INSERTED.CreatedOn
            VALUES (@transactionId, @tag)
        `;

        const tagResult = await db.executeQuery<ITransactionTagSQL[]>(insertTagQuery, {
            transactionId: validTransactionId,
            tag
        });

        if (!tagResult || tagResult.length === 0) {
            throw new StatusError('Failed to add tag to transaction');
        }

        return {
            id: parseInt(tagResult[0].Id),
            transactionId: parseInt(tagResult[0].TransactionId),
            tag: tagResult[0].Tag,
            createdOn: tagResult[0].CreatedOn
        };
    }

    /**
     * Get all tags for a transaction
     * @param userId User ID making the request
     * @param transactionId Transaction ID to get tags for
     * @returns Array of transaction tags
     */
    public static async getTransactionTags(userId: number, transactionId: number): Promise<ITransactionTag[]> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            transactionId
        }, {
            userId: customValidators.id,
            transactionId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, transactionId: validTransactionId } = validatedDataOrErrors;

        // Check if transaction exists and user has access to it
        const transaction = await this.getTransactionById(validUserId, validTransactionId);
        if (!transaction) {
            throw new StatusError('Transaction not found or you do not have access to it', 404);
        }

        // Return the tags
        return transaction.tags || [];
    }

    /**
     * Remove a tag from a transaction
     * @param userId User ID making the request
     * @param transactionId Transaction ID to remove tag from
     * @param tagId Tag ID to remove
     * @returns True if successful
     */
    public static async removeTransactionTag(userId: number, transactionId: number, tagId: number): Promise<boolean> {
        const [success, validatedDataOrErrors] = validateObject({
            userId,
            transactionId,
            tagId
        }, {
            userId: customValidators.id,
            transactionId: customValidators.id,
            tagId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, transactionId: validTransactionId, tagId: validTagId } = validatedDataOrErrors;

        // Check if transaction exists and user has access to it
        const transaction = await this.getTransactionById(validUserId, validTransactionId);
        if (!transaction) {
            throw new StatusError('Transaction not found or you do not have access to it', 404);
        }

        // Check if tag exists
        if (!transaction.tags || !transaction.tags.some(t => t.id === validTagId)) {
            throw new StatusError('Tag not found for this transaction', 404);
        }

        // Remove the tag
        const deleteTagQuery = `
            DELETE FROM Finance.TransactionTags
            WHERE Id = @tagId AND TransactionId = @transactionId
        `;

        await db.executeQuery(deleteTagQuery, {
            tagId: validTagId,
            transactionId: validTransactionId
        });

        return true;
    }
}