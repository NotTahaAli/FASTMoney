import { StatusError } from "@/middleware/errorHandler.middleware";
import { decrypt, encrypt } from "@/utils/jwt.util";
import { JWTPayload } from "jose";

export type SessionPayload = {
    userId: number,
    userName: string,
    exp: number,
    iat: number
} & JWTPayload

export async function createSession(userId: number, userName: string, exp?: string) {
    return await encrypt({ userId, userName }, exp)
}

export function verifySession(payload: JWTPayload): payload is SessionPayload {
    if (!payload) {
        throw new StatusError('Invalid payload', 401)
    }
    if (typeof payload === 'string') {
        throw new StatusError('Invalid payload', 401)
    }
    if (typeof payload.userId !== 'number' || typeof payload.userName !== 'string') {
        throw new StatusError('Missing required fields in payload', 401)
    }
    if (payload.userId <= 0) {
        throw new StatusError('Invalid userId in payload', 401)
    }
    if (payload.userName.length <= 0) {
        throw new StatusError('Invalid userName in payload', 401)
    }
    return true;
}

export async function getSession(request: Request) {
    const session = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!session) {
        throw new StatusError('Session not found', 401)
    }
    const payload = await decrypt(session)
    try {
        if (verifySession(payload)) {
            return payload
        }
    } catch (error) {
        if (error instanceof StatusError) {
            error.status = 401;
            throw error;
        }
        if (error instanceof Error || typeof error === 'string') {
            throw new StatusError(error, 401)
        }
    }
    throw new StatusError('Invalid session', 401)
}