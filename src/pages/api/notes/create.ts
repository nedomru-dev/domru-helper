/**
 * POST /api/notes/create
 *
 * Encrypted request:  { agreement: string, text: string, authorName?: string }
 * Encrypted response: { success, data: { note: ClientNote } }
 */

import type { APIRoute } from 'astro';
import { secureError, secureProtectedRoute } from '@/lib/auth/secure-route';
import { createNote } from '@/lib/db/notes';

interface CreateRequest {
    agreement: string;
    text: string;
    authorName?: string;
}

const MAX_TEXT_LENGTH = 2000;

export const POST = secureProtectedRoute<CreateRequest, {note: Awaited<ReturnType<typeof createNote>>}>(
    async (payload, token) => {
        if (!payload.agreement || typeof payload.agreement !== 'string') {
            throw secureError(400, 'agreement is required');
        }
        const text = (payload.text ?? '').trim();
        if (!text) {
            throw secureError(400, 'text is required');
        }
        if (text.length > MAX_TEXT_LENGTH) {
            throw secureError(400, `text must be at most ${MAX_TEXT_LENGTH} characters`);
        }
        const authorName =
            (payload.authorName ?? '').trim().slice(0, 200) || `id${token.sub}`;
        const note = await createNote({
            agreement: payload.agreement,
            text,
            authorUserId: token.sub,
            authorName,
        });
        return {note};
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
