-- seed.sql -- demo data so the app has something to show on first run.
-- Safe to re-run: it clears the tables first.

TRUNCATE transfers, fx_rates, wallets, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, country) VALUES
    ('Amina Bello',   'NG'),   -- 1
    ('Kofi Mensah',   'GH'),   -- 2
    ('Zawadi Otieno', 'KE'),   -- 3
    ('Chidi Okafor',  'NG');   -- 4

-- balances in minor units: NGN 5,000,000.00 = 500000000 kobo, etc.
INSERT INTO wallets (user_id, label, currency, balance_minor) VALUES
    (1, 'Amina - NGN',   'NGN', 500000000),   -- 1  (5,000,000.00)
    (2, 'Kofi - GHS',    'GHS',   1200000),   -- 2  (12,000.00)
    (3, 'Zawadi - KES',  'KES',  25000000),   -- 3  (250,000.00)
    (4, 'Chidi - NGN',   'NGN',  80000000);   -- 4  (800,000.00)

-- FX rates (illustrative). Same-currency transfers use rate 1 in code.
INSERT INTO fx_rates (base, quote, rate) VALUES
    ('NGN','KES', 0.08500000),
    ('KES','NGN', 11.76000000),
    ('NGN','GHS', 0.00960000),
    ('GHS','NGN', 104.00000000),
    ('GHS','KES', 0.89000000),
    ('KES','GHS', 1.12000000),
    ('NGN','NGN', 1.00000000),
    ('GHS','GHS', 1.00000000),
    ('KES','KES', 1.00000000);

-- a little history so the transfers list isn't empty
INSERT INTO transfers (from_wallet, to_wallet, sent_minor, fee_minor, fx_rate, credited_minor, status, created_at) VALUES
    (1, 3,  5000000, 70000, 0.08500000, 419050, 'settled', now() - interval '2 days'),
    (4, 2,  2000000, 28000, 0.00960000,  18931, 'settled', now() - interval '1 day'),
    (1, 3, 10000000,140000, 0.08500000, 838100, 'settled', now() - interval '3 hours');
