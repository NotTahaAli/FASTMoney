import 'server-only';
import { JWTPayload, SignJWT, jwtVerify } from 'jose'
import { StatusError } from '@/middleware/errorHandler.middleware';

const secretKey = process.env.JWT_SECRET;
const expirationTime = process.env.JWT_EXPIRATION || '1d';

if (!secretKey) {
    throw new StatusError('JWT_SECRET is not set', 500);
}
 
const encodedKey = new TextEncoder().encode(secretKey)
 
export async function encrypt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(encodedKey)
}

function verifyPayload(payload: JWTPayload) {
    if (!payload.exp) {
        throw new StatusError('Missing expiration time')
    }
    if (!payload.iat) {
        throw new StatusError('Missing issued at time')
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new StatusError('Token expired')
    }
    if (payload.iat && payload.iat > Math.floor(Date.now() / 1000)) {
        throw new StatusError('Token not yet valid')
    }
}

export async function decrypt(session: string) {
    const { payload } = await jwtVerify(session, encodedKey, {
        algorithms: ['HS256'],
    })
    verifyPayload(payload)
    return payload
}