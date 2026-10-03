-- schema.sql -- the Paystream wallet database (PostgreSQL 16).
-- Money is stored in MINOR units (kobo, pesewa, cents) as BIGINT integers.

CREATE TABLE IF NOT EXISTS users (
    id       SERIAL PRIMARY KEY,
    name     TEXT     NOT NULL,
    country  CHAR(2)  NOT NULL          -- NG, GH, KE
);

CREATE TABLE IF NOT EXISTS wallets (
    id             SERIAL PRIMARY KEY,
    user_id        INT     NOT NULL REFERENCES users(id),
    label          TEXT    NOT NULL,    -- e.g. "Amina - NGN"
    currency       CHAR(3) NOT NULL,    -- NGN, GHS, KES
    balance_minor  BIGINT  NOT NULL DEFAULT 0 CHECK (balance_minor >= 0)
);

-- FX rates: how many units of `quote` you get for one unit of `base`.
CREATE TABLE IF NOT EXISTS fx_rates (
    base   CHAR(3)       NOT NULL,
    quote  CHAR(3)       NOT NULL,
    rate   NUMERIC(18,8) NOT NULL,
    PRIMARY KEY (base, quote)
);

CREATE TABLE IF NOT EXISTS transfers (
    id              SERIAL PRIMARY KEY,
    from_wallet     INT          NOT NULL REFERENCES wallets(id),
    to_wallet       INT          NOT NULL REFERENCES wallets(id),
    sent_minor      BIGINT       NOT NULL,   -- debited from sender (incl. fee)
    fee_minor       BIGINT       NOT NULL,   -- Paystream's 1.4%
    fx_rate         NUMERIC(18,8) NOT NULL,  -- rate used, stored on the row
    credited_minor  BIGINT       NOT NULL,   -- credited to recipient
    status          TEXT         NOT NULL DEFAULT 'settled',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_wallet);
CREATE INDEX IF NOT EXISTS idx_transfers_to   ON transfers(to_wallet);
