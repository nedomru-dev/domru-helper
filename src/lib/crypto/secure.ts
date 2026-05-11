/**
 * Hybrid encryption helpers for E2E-encrypted API calls.
 *
 * Wire format (client → server and server → client):
 *   {
 *     encryptedKey: base64,   // present only on the request: AES key wrapped with RSA-OAEP
 *     iv: base64,             // 12-byte IV for AES-GCM
 *     ciphertext: base64,     // AES-GCM ciphertext (without auth tag)
 *     authTag: base64         // 16-byte AES-GCM auth tag
 *   }
 *
 * The AES-256 key is generated per request on the client, RSA-encrypted with
 * the server's public key, and reused by the server to encrypt the response.
 * This means callers can encrypt arbitrary JSON payloads end-to-end without
 * a long-lived shared secret.
 */

import * as crypto from 'node:crypto';
import { getPrivateKey } from './rsa';

const AES_ALGO = 'aes-256-gcm';
const AES_KEY_LEN = 32;
const AES_IV_LEN = 12;
const AES_TAG_LEN = 16;

export interface SecureEnvelope {
    encryptedKey?: string;
    iv: string;
    ciphertext: string;
    authTag: string;
}

export interface SecureRequest extends SecureEnvelope {
    encryptedKey: string;
}

export interface DecryptedRequest<T = unknown> {
    payload: T;
    aesKey: Buffer;
}

export function decryptRequest<T = unknown>(envelope: SecureRequest): DecryptedRequest<T> {
    if (!envelope.encryptedKey || !envelope.iv || !envelope.ciphertext || !envelope.authTag) {
        throw new Error('Malformed secure request envelope');
    }

    const privateKeyPem = getPrivateKey();
    const wrappedKey = Buffer.from(envelope.encryptedKey, 'base64');
    const aesKey = crypto.privateDecrypt(
        {
            key: privateKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        wrappedKey,
    );

    if (aesKey.length !== AES_KEY_LEN) {
        throw new Error(`Unexpected AES key length: ${aesKey.length}`);
    }

    const iv = Buffer.from(envelope.iv, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');

    if (iv.length !== AES_IV_LEN || authTag.length !== AES_TAG_LEN) {
        throw new Error('Invalid IV or auth tag length');
    }

    const decipher = crypto.createDecipheriv(AES_ALGO, aesKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf-8',
    );

    return {payload: JSON.parse(plaintext) as T, aesKey};
}

export function encryptResponse(aesKey: Buffer, payload: unknown): SecureEnvelope {
    const iv = crypto.randomBytes(AES_IV_LEN);
    const cipher = crypto.createCipheriv(AES_ALGO, aesKey, iv);
    const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf-8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        authTag: authTag.toString('base64'),
    };
}

const SECURE_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export function secureResponse(aesKey: Buffer, payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(encryptResponse(aesKey, payload)), {
        status,
        headers: SECURE_HEADERS,
    });
}

export function plainErrorResponse(error: string, status: number): Response {
    return new Response(JSON.stringify({success: false, error}), {
        status,
        headers: SECURE_HEADERS,
    });
}
