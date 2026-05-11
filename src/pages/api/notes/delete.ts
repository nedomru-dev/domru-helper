/**
 * POST /api/notes/delete
 *
 * Encrypted request:  { id: string }
 * Encrypted response: { success, data: { deleted: boolean } }
 *
 * Only the author of a note may delete it.
 */

import type { APIRoute } from 'astro';
import { secureError, secureProtectedRoute } from '@/lib/auth/secure-route';
import { deleteNote } from '@/lib/db/notes';

interface DeleteRequest {
    id: string;
}

export const POST = secureProtectedRoute<DeleteRequest, {deleted: boolean}>(
    async (payload, token) => {
        if (!payload.id || typeof payload.id !== 'string') {
            throw secureError(400, 'id is required');
        }
        const deleted = await deleteNote(payload.id, token.sub);
        return {deleted};
    },
);

export const OPTIONS: APIRoute = async () =>
    new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
