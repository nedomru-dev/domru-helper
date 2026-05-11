-- Client notes shared across all authenticated operators.
-- Notes are auto-purged after 7 days by the API layer.

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
