/**
 * POST /api/notes/list
 *
 * Encrypted request:  { agreement: string }
 * Encrypted response: { success, data: { notes: ClientNote[] } }
 *
 * Returns notes for the given agreement, shared across all operators.
 * Notes older than 7 days are purged opportunistically.
 */

import type { APIRoute } from 'astro';
import { secureError, secureProtectedRoute } from '@/lib/auth/secure-route';
import { listNotes } from '@/lib/db/notes';

interface ListRequest {
    agreement: string;
}

export const POST = secureProtectedRoute<ListRequest, {notes: Awaited<ReturnType<typeof listNotes>>}>(
    async (payload) => {
        if (!payload.agreement || typeof payload.agreement !== 'string') {
            throw secureError(400, 'agreement is required');
        }
        const notes = await listNotes(payload.agreement);
        return {notes};
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
