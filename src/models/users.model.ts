import db from '@/services/db.service';
import bcrypt from 'bcrypt';
import { customValidators, validateObject } from '@/utils/validator.util';
import { StatusError } from '@/middleware/errorHandler.middleware';
import { decrypt, encrypt, refreshExpirationTime } from '@/utils/jwt.util';
import { createSession, verifySession } from '@/utils/session.util';

export interface IUser {
    Id: number;
    Username: string;
    Email: string;
    CreatedOn: Date;
    ModifiedOn: Date;
}

export interface IUserWithPassword extends IUser {
    Password: Buffer;
}

export interface IUserRegistration {
    username: string;
    email: string;
    password: string;
}

export interface IUserLogin {
    usernameOrEmail: string;
    password: string;
}

export interface IChangePassword {
    userId: number;
    currentPassword: string;
    newPassword: string;
}

export interface IUserRefresh {
    refreshToken: string;
}

export class User {
    /**
     * Register a new user
     * @param userData User registration data
     * @returns Newly created user without password
     */
    public static async register(userData: IUserRegistration): Promise<{ user: IUser, token: string, refreshToken: string }> {
        // Check if username or email already exists

        const [success, credentialsOrErrors] = validateObject(userData, {
            username: customValidators.username,
            email: customValidators.email,
            password: customValidators.password
        });

        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { username, email, password } = credentialsOrErrors;

        const userExists = await this.checkUserExists(username, email);
        if (userExists) {
            throw new StatusError('Username or email already exists', 409);
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO Auth.Users (Username, Password, Email)
            OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Email, INSERTED.CreatedOn, INSERTED.ModifiedOn
            VALUES (@username, @password, @email)
        `;

        const result = await db.executeQuery<IUser[]>(query, {
            username,
            password: Buffer.from(passwordHash),
            email
        });

        if (!result || result.length === 0) {
            throw new StatusError('Failed to register user');
        }

        const user = result[0];
        console.log(user);
        const token = await createSession(user.Id, user.Username, user.Email);
        const refreshToken = await encrypt({userId: user.Id, userName: user.Username, email: user.Email, refresh: true}, refreshExpirationTime);

        return { user, token, refreshToken };
    }

    /**
     * Login a user with username/email and password
     * @param loginData Login data
     * @returns User without password and auth token if login successful
     */
    public static async login(loginData: IUserLogin): Promise<{ user: IUser, token: string, refreshToken: string }> {
        const [success, credentialsOrErrors] = validateObject(loginData, {
            usernameOrEmail: customValidators.username.or(customValidators.email),
            password: customValidators.password
        });

        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { usernameOrEmail, password } = credentialsOrErrors;

        // Get user with password
        const query = `
            SELECT Id, Username, Password, Email, CreatedOn, ModifiedOn
            FROM Auth.Users
            WHERE Username = @usernameOrEmail OR Email = @usernameOrEmail
        `;

        const users = await db.executeQuery<IUserWithPassword[]>(query, { usernameOrEmail });

        if (!users || users.length === 0) {
            throw new StatusError('Invalid credentials', 401);
        }

        const user = users[0];
        
        // Verify password
        const passwordMatch = await bcrypt.compare(
            password,
            user.Password.toString()
        );

        if (!passwordMatch) {
            throw new StatusError('Invalid credentials', 401);
        }

        // Remove password from user object
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { Password: _, ...userWithoutPassword } = user;

        // Generate auth token
        const token = await createSession(user.Id, user.Username, user.Email);
        const refreshToken = await encrypt({userId: user.Id, userName: user.Username, email: user.Email, refresh: true}, refreshExpirationTime);

        return {
            user: userWithoutPassword,
            token,
            refreshToken
        };
    }

    /**
     * Refresh user session
     * @param refreshData Refresh token data
     * @returns User without password and new auth token if login successful
     */
    public static async refresh(refreshData: IUserRefresh): Promise<{ user: IUser, token: string }> {
        const [success, credentialsOrErrors] = validateObject(refreshData, {
            refreshToken: customValidators.jwt
        });

        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message, 401);
        }

        const { refreshToken } = credentialsOrErrors;

        const payload = await decrypt(refreshToken);
        if (!verifySession(payload)) {
            throw new StatusError('Invalid refresh token', 401);
        }
        if (!payload.refresh) {
            throw new StatusError('Invalid refresh token', 401);
        }

        // Get user without password
        const user = await this.getUserById(payload.userId);
        if (!user) {
            throw new StatusError('User not found', 401);
        }
        if (Math.floor(user.ModifiedOn.getTime()/1000) > payload.iat) {
            throw new StatusError('Refresh token expired', 401);
        }

        // Generate new auth token
        const token = await createSession(user.Id, user.Username, user.Email);

        return { user, token };
    }

    /**
     * Change user password
     * @param changePasswordData Password change data
     * @returns True if password changed successfully
     */
    public static async changePassword(changePasswordData: IChangePassword) {
        if (changePasswordData.currentPassword === changePasswordData.newPassword) {
            throw new StatusError('New password cannot be the same as current password');
        }
        const [success, credentialsOrErrors] = validateObject(changePasswordData, {
            userId: customValidators.id,
            currentPassword: customValidators.password,
            newPassword: customValidators.password
        });
        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId, currentPassword, newPassword } = credentialsOrErrors;

        // Get user with password
        const query = `
            SELECT Id, Username, Email, Password
            FROM Auth.Users
            WHERE Id = @userId
        `;

        const users = await db.executeQuery<{ Id: number, Username: string, Email: string, Password: Buffer }[]>(query, { userId });

        if (!users || users.length === 0) {
            throw new StatusError('User not found', 404);
        }

        const user = users[0];

        // Verify current password
        const passwordMatch = await bcrypt.compare(
            currentPassword,
            user.Password.toString()
        );

        if (!passwordMatch) {
            throw new StatusError('Current password is incorrect');
        }

        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await db.executeStoredProcedure("Auth.ChangePassword", {
            Id: userId,
            NewPassword: Buffer.from(newPasswordHash)
        });

        const token = await createSession(userId, user.Username, user.Email);
        const refreshToken = await encrypt({userId: user.Id, userName: user.Username, email: user.Email, refresh: true}, refreshExpirationTime);

        return [token, refreshToken];
    }

    /**
     * Get user by ID
     * @param userId User ID
     * @returns User without password
     */
    public static async getUserById(userId: number): Promise<IUser | null> {
        const [success, credentialsOrErrors] = validateObject({ userId }, {
            userId: customValidators.id
        });
        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }

        const { userId: validatedUserId } = credentialsOrErrors;
        const query = `
            SELECT Id, Username, Email, CreatedOn, ModifiedOn
            FROM Auth.Users
            WHERE Id = @userId
        `;

        const users = await db.executeQuery<IUser[]>(query, { userId: validatedUserId });

        if (!users || users.length === 0) {
            return null;
        }

        return users[0];
    }

    /**
     * Find a user by username or email
     * @param identifier Username or email
     * @returns User without password if found, null otherwise
     */
    public static async findByUsernameOrEmail(identifier: string): Promise<IUser | null> {
        const [success, credentialsOrErrors] = validateObject({ identifier }, {
            identifier: customValidators.username.or(customValidators.email)
        });
        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }
        const { identifier: validatedIdentifier } = credentialsOrErrors;

        const query = `
            SELECT Id, Username, Email, CreatedOn, ModifiedOn
            FROM Auth.Users
            WHERE Username = @identifier OR Email = @identifier
        `;

        const users = await db.executeQuery<IUser[]>(query, { identifier: validatedIdentifier });

        if (!users || users.length === 0) {
            return null;
        }

        return users[0];
    }

    /**
     * Check if username or email already exists
     * @param username Username to check
     * @param email Email to check
     * @returns True if username or email exists
     */
    private static async checkUserExists(username: string, email: string): Promise<boolean> {
        const [success, credentialsOrErrors] = validateObject({ username, email }, {
            username: customValidators.username,
            email: customValidators.email
        });
        if (!success) {
            const error = credentialsOrErrors.errors[0];
            throw new StatusError(error.path.join(".") + ": " + error.message);
        }
        const { username: validatedUsername, email: validatedEmail } = credentialsOrErrors;

        const query = `
            SELECT COUNT(*) as count
            FROM Auth.Users
            WHERE Username = @username OR Email = @email
        `;

        const result = await db.executeQuery<{ count: number }[]>(query, { username: validatedUsername, email: validatedEmail });

        return result[0].count > 0;
    }
}
