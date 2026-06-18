-- ============================================================
-- FaceAuth — Schéma PostgreSQL Initial
-- À exécuter manuellement sur la base Railway ou en migration
-- ============================================================

-- Extension vecteur (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- TABLE : developers
-- Comptes des développeurs qui utilisent le SDK FaceAuth
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS developers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- TABLE : api_keys
-- Clés API générées par les développeurs (sk_live_...)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    key_hash     VARCHAR(255) UNIQUE NOT NULL,  -- Bcrypt hash de la clé complète
    key_prefix   VARCHAR(20)  NOT NULL,          -- "sk_live_XXXX" affiché dans le dashboard
    name         VARCHAR(100),                   -- Nom donné par le dev (ex: "Production App")
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    credits      INTEGER NOT NULL DEFAULT 500,   -- Pack Découverte offert
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- -------------------------------------------------------
-- TABLE : biometric_embeddings
-- Vecteurs biométriques des utilisateurs finaux
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS biometric_embeddings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id   UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    end_user_id  VARCHAR(255) NOT NULL,           -- ID utilisateur côté client développeur
    embedding    vector(512) NOT NULL,            -- FaceNet512 = 512 dimensions
    model_used   VARCHAR(50) NOT NULL DEFAULT 'Facenet512',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(api_key_id, end_user_id)               -- 1 embedding par utilisateur par clé API
);

-- Index HNSW pour la recherche de similarité cosinus (rapide même à grande échelle)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
    ON biometric_embeddings USING hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------
-- TABLE : challenge_sessions
-- Sessions de défi gestuels (anti-replay)
-- Stockées aussi dans Redis (TTL), ici pour l'audit
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS challenge_sessions (
    session_id       VARCHAR(255) PRIMARY KEY,
    api_key_id       UUID NOT NULL REFERENCES api_keys(id),
    gesture_sequence VARCHAR(100) NOT NULL,  -- ex: "blink,mouth,left,right"
    expires_at       TIMESTAMPTZ NOT NULL,
    used             BOOLEAN NOT NULL DEFAULT FALSE,
    used_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour le nettoyage des sessions expirées
CREATE INDEX IF NOT EXISTS idx_challenge_sessions_expires
    ON challenge_sessions (expires_at);

-- -------------------------------------------------------
-- TABLE : audit_logs
-- Journal immuable de toutes les vérifications
-- Obligatoire pour la conformité KYC
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id          UUID REFERENCES api_keys(id),
    end_user_id         VARCHAR(255),
    action              VARCHAR(50) NOT NULL,     -- 'enroll', 'verify_success', 'verify_failed', 'error'
    success             BOOLEAN NOT NULL,
    similarity_score    FLOAT,                    -- Score cosinus (null si enrôlement)
    session_id          VARCHAR(255),
    image_received_at   TIMESTAMPTZ,              -- Preuve de réception
    image_destroyed_at  TIMESTAMPTZ,              -- Preuve de destruction (< 500ms après)
    ip_address          VARCHAR(45),
    error_code          VARCHAR(50),
    credits_before      INTEGER,
    credits_after       INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes d'audit fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key
    ON audit_logs (api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs (end_user_id, created_at DESC);

-- -------------------------------------------------------
-- Fonction utilitaire : mise à jour automatique de updated_at
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_biometric_embeddings_updated_at
    BEFORE UPDATE ON biometric_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
