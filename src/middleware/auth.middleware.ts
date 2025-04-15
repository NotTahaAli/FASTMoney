import { IUser, User } from '@/models/users.model';
import { getSession } from "@/utils/session.util";
import { StatusError } from './errorHandler.middleware';
import { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user: IUser;
}

/**
 * Authentication middleware for API routes
 * Verifies the JWT token and attaches the user to the request
 * @param request The incoming request
 * @returns Either the authenticated request or an error response
 */
export async function authenticate(request: Request): Promise<AuthenticatedRequest | Response> {
  try {
    const session = await getSession(request);
    
    // Verify user still exists and hasn't been deleted
    const user = await User.getUserById(session.userId);
    if (!user) {
      throw new StatusError('User not found', 401);
    }

    if (Math.floor(user.ModifiedOn.getTime()/1000) > session.iat) {
      throw new StatusError('User data has changed, please log in again', 401);
    }

    // Extend the request with the user session
    (request as AuthenticatedRequest).user = user;
    
    return request as AuthenticatedRequest;
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    if (error instanceof Error || typeof(error) === 'string') {
      throw new StatusError(error, 401);
    }
    throw new StatusError('Unauthorized', 401);
  }
}

/**
 * Higher-order function that wraps an API handler with authentication
 * @param handler The API handler function to wrap
 * @returns A new handler function that includes authentication
 */
export function withAuth<T extends unknown[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<Response> | Response
) {
  return async (request: Request | NextRequest, ...args: T) => {
    const authResult = await authenticate(request);
    
    if (authResult instanceof Response) {
      // Authentication failed, return the error response
      return authResult;
    }
    
    // Authentication successful, call the handler with the authenticated request
    return handler(authResult, ...args);
  };
}

/**
 * Helper function to get the current user from the request
 * Useful in API route handlers after authentication
 * @param request The authenticated request
 * @returns The current user from the session
 */
export function getCurrentUser(request: AuthenticatedRequest): IUser {
  return request.user;
}