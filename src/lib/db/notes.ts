/**
 * Client notes storage — shared between all authenticated operators.
 *
 * Notes are auto-purged after 7 days. Cleanup runs opportunistically before
 * each list query so callers don't need an external cron.
 */

import { getPool } from './postgres';

const RETENTION_DAYS = 7;

export interface ClientNote {
    id: string;
    agreement: string;
    text: string;
    authorUserId: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
}

interface DbClientNote {
    id: string;
    agreement: string;
    text: string;
    author_user_id: string;
    author_name: string;
    created_at: Date;
    updated_at: Date;
}

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
    if (schemaEnsured) return;
    const pool = getPool();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS client_notes (
            id BIGSERIAL PRIMARY KEY,
            agreement TEXT NOT NULL,
            text TEXT NOT NULL,
            author_user_id BIGINT NOT NULL,
            author_name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_client_notes_agreement ON client_notes(agreement);
        CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON client_notes(created_at);
    `);
    schemaEnsured = true;
}

function rowToNote(row: DbClientNote): ClientNote {
    return {
        id: row.id.toString(),
        agreement: row.agreement,
        text: row.text,
        authorUserId: row.author_user_id.toString(),
        authorName: row.author_name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

export async function purgeExpired(): Promise<number> {
    await ensureSchema();
    const result = await getPool().query(
        `DELETE FROM client_notes WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`,
    );
    return result.rowCount ?? 0;
}

export async function listNotes(agreement: string): Promise<ClientNote[]> {
    await ensureSchema();
    void purgeExpired().catch((err) => console.error('[notes] purge failed:', err));
    const result = await getPool().query<DbClientNote>(
        'SELECT id, agreement, text, author_user_id, author_name, created_at, updated_at FROM client_notes WHERE agreement = $1 ORDER BY created_at DESC',
        [agreement],
    );
    return result.rows.map(rowToNote);
}

export async function createNote(input: {
    agreement: string;
    text: string;
    authorUserId: string;
    authorName: string;
}): Promise<ClientNote> {
    await ensureSchema();
    const result = await getPool().query<DbClientNote>(
        `INSERT INTO client_notes (agreement, text, author_user_id, author_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, agreement, text, author_user_id, author_name, created_at, updated_at`,
        [input.agreement, input.text, input.authorUserId, input.authorName],
    );
    return rowToNote(result.rows[0]);
}

export async function deleteNote(id: string, authorUserId: string): Promise<boolean> {
    await ensureSchema();
    const result = await getPool().query(
        'DELETE FROM client_notes WHERE id = $1 AND author_user_id = $2',
        [id, authorUserId],
    );
    return (result.rowCount ?? 0) > 0;
}
