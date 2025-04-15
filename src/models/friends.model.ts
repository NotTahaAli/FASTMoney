import db, { commitTransaction, rollbackTransaction, startTransaction } from '@/services/db.service';
import { StatusError } from '@/middleware/errorHandler.middleware';
import { customValidators, validateObject } from '@/utils/validator.util';
import { z } from 'zod';

export interface IFriendSQL {
    UserId: number;
    FriendId: number;
    Username: string;
    CreatedOn: Date;
}

export interface IFriend {
    userId: number;
    username: string;
    createdOn: Date;
}

export interface IFriendRequest {
    userId: number;
    username: string;
    requestedOn: Date;
}

export interface IFriendRequestSend {
    friendIdentifier: string;
}

export interface IFriendRequestResponse {
    action: 'accept' | 'reject';
}

export interface IFriendAccount {
    id: number;
    name: string;
    createdOn: Date;
}

export interface IFriendAccounts {
    userId: number;
    username: string;
    accounts: IFriendAccount[];
}

export class Friend {
    /**
     * Get a user's friend list
     * @param userId User ID to get friends for
     * @returns Array of friends
     */
    public static async getFriends(userId: number): Promise<IFriend[]> {
        const [success, validatedDataOrErrors] = validateObject({ userId }, {
            userId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId } = validatedDataOrErrors;

        const query = `
            SELECT f.UserId, f.FriendId, u.Username, f.CreatedOn
            FROM Friends.Friends f
            JOIN Auth.Users u ON f.FriendId = u.Id
            WHERE f.UserId = @userId
            ORDER BY f.CreatedOn DESC
        `;

        const result = await db.executeQuery<IFriendSQL[]>(query, { userId: validUserId });

        return result.map(friend => ({
            userId: friend.FriendId,
            username: friend.Username,
            createdOn: friend.CreatedOn
        }));
    }

    /**
     * Get all pending friend requests for a user
     * @param userId User ID to get friend requests for
     * @returns Array of friend requests
     */
    public static async getFriendRequests(userId: number): Promise<IFriendRequest[]> {
        const [success, validatedDataOrErrors] = validateObject({ userId }, {
            userId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId } = validatedDataOrErrors;

        const query = `
            SELECT fr.UserId, u.Username, fr.CreatedOn
            FROM Friends.FriendRequests fr
            JOIN Auth.Users u ON fr.UserId = u.Id
            WHERE fr.FriendId = @userId
            ORDER BY fr.CreatedOn DESC
        `;

        const result = await db.executeQuery<{ UserId: number; Username: string; CreatedOn: Date }[]>(query, { userId: validUserId });

        return result.map(request => ({
            userId: request.UserId,
            username: request.Username,
            requestedOn: request.CreatedOn
        }));
    }

    /**
     * Send a friend request to another user
     * @param userId User ID sending the request
     * @param friendRequest Friend request data containing friendIdentifier (email or username)
     */
    public static async sendFriendRequest(userId: number, friendRequest: IFriendRequestSend): Promise<void> {
        const [success, validatedDataOrErrors] = validateObject({ 
            userId, 
            ...friendRequest 
        }, {
            userId: customValidators.id,
            friendIdentifier: customValidators.nonEmptyString
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, friendIdentifier } = validatedDataOrErrors;

        // First, find the friend by username or email
        const findFriendQuery = `
            SELECT Id
            FROM Auth.Users
            WHERE Username = @friendIdentifier OR Email = @friendIdentifier
        `;

        const findFriendResult = await db.executeQuery<{ Id: number }[]>(findFriendQuery, { friendIdentifier });

        if (!findFriendResult.length) {
            throw new StatusError('User not found with the provided username/email', 404);
        }

        const friendId = findFriendResult[0].Id;

        if (friendId === validUserId) {
            throw new StatusError('You cannot send a friend request to yourself', 400);
        }

        // Check if they are already friends
        if (await this.isFriend(validUserId, friendId)) {
            throw new StatusError('You are already friends with this user', 400);
        }

        // Check if there's already a pending request in either direction
        const checkRequestQuery = `
            SELECT COUNT(*) as count
            FROM Friends.FriendRequests
            WHERE (UserId = @userId AND FriendId = @friendId)
               OR (UserId = @friendId AND FriendId = @userId)
        `;

        const checkRequestResult = await db.executeQuery<{ count: number }[]>(checkRequestQuery, { 
            userId: validUserId,
            friendId 
        });

        if (checkRequestResult[0].count > 0) {
            throw new StatusError('A friend request already exists between you and this user', 400);
        }

        // Insert the friend request
        const insertQuery = `
            INSERT INTO Friends.FriendRequests (UserId, FriendId)
            VALUES (@userId, @friendId)
        `;

        await db.executeQuery(insertQuery, { 
            userId: validUserId,
            friendId 
        });
    }

    /**
     * Respond to a friend request (accept or reject)
     * @param userId User ID responding to the request
     * @param friendId User ID who sent the friend request
     * @param response Response action (accept or reject)
     */
    public static async respondToFriendRequest(userId: number, friendId: number, response: IFriendRequestResponse): Promise<void> {
        const [success, validatedDataOrErrors] = validateObject({ 
            userId,
            friendId,
            ...response
        }, {
            userId: customValidators.id,
            friendId: customValidators.id,
            action: z.enum(['accept', 'reject'])
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, friendId: validFriendId, action } = validatedDataOrErrors;

        // Check if the friend request exists
        const checkRequestQuery = `
            SELECT COUNT(*) as count
            FROM Friends.FriendRequests
            WHERE UserId = @friendId AND FriendId = @userId
        `;

        const checkRequestResult = await db.executeQuery<{ count: number }[]>(checkRequestQuery, { 
            userId: validUserId,
            friendId: validFriendId 
        });

        if (checkRequestResult[0].count === 0) {
            throw new StatusError('Friend request not found', 404);
        }

        if (action === 'accept') {
            // Begin transaction to accept friend request
            const tx = await startTransaction();
            
            try {
                // Add bidirectional friendship
                const addFriendQuery = `
                    INSERT INTO Friends.Friends (UserId, FriendId)
                    VALUES 
                        (@userId, @friendId)
                `;

                await db.executeQuery(addFriendQuery, {
                    userId: validUserId,
                    friendId: validFriendId
                }, tx);

                // Delete the friend request
                const deleteRequestQuery = `
                    DELETE FROM Friends.FriendRequests
                    WHERE UserId = @friendId AND FriendId = @userId
                `;

                await db.executeQuery(deleteRequestQuery, {
                    userId: validUserId,
                    friendId: validFriendId
                }, tx);

                await commitTransaction(tx);
            } catch (error) {
                await rollbackTransaction(tx);
                throw error;
            }
        } else {
            // Simply delete the friend request for rejection
            const deleteRequestQuery = `
                DELETE FROM Friends.FriendRequests
                WHERE UserId = @friendId AND FriendId = @userId
            `;

            await db.executeQuery(deleteRequestQuery, {
                userId: validUserId,
                friendId: validFriendId
            });
        }
    }

    /**
     * Remove a friend from the user's friend list
     * @param userId User ID removing the friend
     * @param friendId Friend ID to be removed
     */
    public static async removeFriend(userId: number, friendId: number): Promise<void> {
        const [success, validatedDataOrErrors] = validateObject({ 
            userId,
            friendId 
        }, {
            userId: customValidators.id,
            friendId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, friendId: validFriendId } = validatedDataOrErrors;

        // Check if the friendship exists
        if (!(await this.isFriend(validUserId, validFriendId))) {
            throw new StatusError('Friend not found', 404);
        }

        // Delete the friendship in both directions
        const removeFriendQuery = `
            DELETE FROM Friends.Friends
            WHERE (UserId = @userId AND FriendId = @friendId)
               OR (UserId = @friendId AND FriendId = @userId)
        `;

        await db.executeQuery(removeFriendQuery, { 
            userId: validUserId,
            friendId: validFriendId 
        });
    }

    /**
     * Get a friend's accounts (without showing balance)
     * @param userId User ID requesting the friend's accounts
     * @param friendId Friend's user ID
     * @returns Friend's account information (without balance)
     */
    public static async getFriendAccounts(userId: number, friendId: number): Promise<IFriendAccounts> {
        const [success, validatedDataOrErrors] = validateObject({ 
            userId,
            friendId 
        }, {
            userId: customValidators.id,
            friendId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, friendId: validFriendId } = validatedDataOrErrors;

        if (!(await this.isFriend(validUserId, validFriendId))) {
            throw new StatusError('This user is not in your friend list', 403);
        }

        // Get friend's username
        const getUsernameQuery = `
            SELECT Username
            FROM Auth.Users
            WHERE Id = @friendId
        `;

        const usernameResult = await db.executeQuery<{ Username: string }[]>(getUsernameQuery, { 
            friendId: validFriendId 
        });

        if (!usernameResult.length) {
            throw new StatusError('Friend not found', 404);
        }

        // Get friend's accounts (without balance)
        const getAccountsQuery = `
            SELECT Id, Name, CreatedOn
            FROM Finance.Accounts
            WHERE UserId = @friendId
            ORDER BY CreatedOn DESC
        `;

        const accountsResult = await db.executeQuery<{ Id: string; Name: string; CreatedOn: Date }[]>(getAccountsQuery, { 
            friendId: validFriendId 
        });

        return {
            userId: validFriendId,
            username: usernameResult[0].Username,
            accounts: accountsResult.map(account => ({
                id: parseInt(account.Id),
                name: account.Name,
                createdOn: account.CreatedOn
            }))
        };
    }

    /**
     * Check if two users are friends
     * @param userId First user ID
     * @param friendId Second user ID to check friendship against
     * @returns Boolean indicating if the users are friends
     */
    public static async isFriend(userId: number, friendId: number): Promise<boolean> {
        const [success, validatedDataOrErrors] = validateObject({ 
            userId,
            friendId 
        }, {
            userId: customValidators.id,
            friendId: customValidators.id
        });

        if (!success) {
            const error = validatedDataOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validUserId, friendId: validFriendId } = validatedDataOrErrors;

        // Check if the friendship exists
        const checkFriendshipQuery = `
            SELECT COUNT(*) as count
            FROM Friends.Friends
            WHERE UserId = @userId AND FriendId = @friendId
        `;

        const checkFriendshipResult = await db.executeQuery<{ count: number }[]>(checkFriendshipQuery, { 
            userId: validUserId,
            friendId: validFriendId 
        });

        return checkFriendshipResult[0].count > 0;
    }
}
