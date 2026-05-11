/**
 * Wraps a protected route so that the request and response payloads are
 * end-to-end encrypted via the hybrid RSA+AES-GCM scheme.
 *
 * The wrapped handler receives the decrypted JSON payload and returns the
 * value to be encrypted back to the caller.
 */

import type { APIRoute } from 'astro';
import { protectedRoute } from './middleware';
import type { AuthTokenPayload } from './types';
import {
    decryptRequest,
    plainErrorResponse,
    secureResponse,
    type SecureRequest,
} from '@/lib/crypto/secure';

export interface SecureHandlerError {
    status: number;
    error: string;
}

export type SecureHandler<TReq, TRes> = (
    payload: TReq,
    token: AuthTokenPayload,
) => Promise<TRes> | TRes;

export function secureProtectedRoute<TReq, TRes>(handler: SecureHandler<TReq, TRes>): APIRoute {
    return protectedRoute(async (token, request) => {
        let envelope: SecureRequest;
        try {
            envelope = (await request.json()) as SecureRequest;
        } catch {
            return plainErrorResponse('Invalid JSON envelope', 400);
        }

        let payload: TReq;
        let aesKey: Buffer;
        try {
            ({payload, aesKey} = decryptRequest<TReq>(envelope));
        } catch (err) {
            console.error('[secure-route] decrypt failed:', err);
            return plainErrorResponse('Failed to decrypt request', 400);
        }

        try {
            const result = await handler(payload, token);
            return secureResponse(aesKey, {success: true, data: result});
        } catch (err) {
            const known = err as SecureHandlerError;
            if (known && typeof known.status === 'number' && typeof known.error === 'string') {
                return secureResponse(aesKey, {success: false, error: known.error}, known.status);
            }
            console.error('[secure-route] handler error:', err);
            return secureResponse(aesKey, {success: false, error: 'Internal error'}, 500);
        }
    });
}

export function secureError(status: number, error: string): SecureHandlerError {
    return {status, error};
}
