-- =====================================================================
-- AFIS Fleet Intelligence System — Sample Data
-- 80 SIMs, 68 Vehicles, 80 Devices, 30 Customers across 8 SADC markets
-- All timestamps relative to now() for perpetually realistic data
-- =====================================================================

-- ─── CUSTOMERS ─────────────────────────────────────────────────────────────
INSERT INTO customers (company_name, contact_person, email, phone, market, status, monthly_revenue, vehicle_count) VALUES
  ('Zimtrucks Ltd',         'John Moyo',     'fleet@zimtrucks.com',         '+263771234567', 'ZW', 'active',   3200, 12),
  ('Zamfreight Co',         'Mary Banda',    'fleet@zamfreight.com',        '+260961234567', 'ZM', 'active',   2800, 9),
  ('Botswana Cargo',        'Peter Dlamini', 'fleet@botswanacargo.com',     '+267711234567', 'BW', 'active',   4100, 15),
  ('Mozambique Trans',      'Grace Mutasa',  'fleet@mozambiquetrans.com',   '+258841234567', 'MZ', 'active',   1900, 7),
  ('Malawi Movers',         'David Nkosi',   'fleet@malawimovers.com',      '+265991234567', 'MW', 'active',   1400, 5),
  ('Namibia Fleet',         'John Moyo',     'fleet@namibiafleet.com',      '+264811234567', 'NA', 'active',   2600, 10),
  ('SA Logistics',          'Mary Banda',    'fleet@salogistics.com',       '+27821234567',  'ZA', 'active',   7800, 24),
  ('Tanzania Transport',    'Peter Dlamini', 'fleet@tanzaniatransport.com', '+255751234567', 'TZ', 'active',   2300, 8),
  ('SADC Carriers',         'Grace Mutasa',  'fleet@sadccarriers.com',      '+263772345678', 'ZW', 'active',   5400, 18),
  ('Cross-Border Co',       'David Nkosi',   'fleet@crossborder.com',       '+260962345678', 'ZM', 'active',   3100, 11),
  ('AfriFleet Inc',         'John Moyo',     'fleet@afrifleet.com',         '+267712345678', 'BW', 'active',   6200, 20),
  ('Bantu Logistics',       'Mary Banda',    'fleet@bantulogistics.com',    '+258852345678', 'MZ', 'active',   2700, 9),
  ('Southern Fleet',        'Peter Dlamini', 'fleet@southernfleet.com',     '+265992345678', 'MW', 'active',   1800, 6),
  ('EastAfrica Trans',      'Grace Mutasa',  'fleet@eastafricatrans.com',   '+264812345678', 'NA', 'active',   3300, 12),
  ('Great Lakes Co',        'David Nkosi',   'fleet@greatlakes.com',        '+27832345678',  'ZA', 'active',   8500, 25),
  ('Kalahari Freight',      'John Moyo',     'fleet@kalahari.com',          '+255762345678', 'TZ', 'active',   2100, 7),
  ('Zambezi Cargo',         'Mary Banda',    'fleet@zambezi.com',           '+263773456789', 'ZW', 'active',   4700, 16),
  ('Limpopo Trans',         'Peter Dlamini', 'fleet@limpopo.com',           '+260963456789', 'ZM', 'active',   2400, 8),
  ('Victoria Fleet',        'Grace Mutasa',  'fleet@victoriafleet.com',     '+267713456789', 'BW', 'active',   3900, 14),
  ('Kilimanjaro Co',        'David Nkosi',   'fleet@kilimanjaro.com',       '+258853456789', 'MZ', 'active',   1600, 5),
  ('Harare Haulage',        'John Moyo',     'fleet@hararehaulage.com',     '+265993456789', 'MW', 'active',   2000, 7),
  ('Lusaka Express',        'Mary Banda',    'fleet@lusakaexpress.com',     '+264813456789', 'NA', 'active',   3700, 13),
  ('Gaborone Trans',        'Peter Dlamini', 'fleet@gaboronetrans.com',     '+27843456789',  'ZA', 'active',   6100, 19),
  ('Maputo Movers',         'Grace Mutasa',  'fleet@maputomove.com',        '+255773456789', 'TZ', 'active',   2200, 8),
  ('Lilongwe Logistics',    'David Nkosi',   'fleet@lilongwelogistics.com', '+263774567890', 'ZW', 'active',   4200, 15),
  ('Windhoek Fleet',        'John Moyo',     'fleet@windhoekfleet.com',     '+260964567890', 'ZM', 'inactive', 500,  2),
  ('Joburg Carriers',       'Mary Banda',    'fleet@joburgcarriers.com',    '+267714567890', 'BW', 'inactive', 700,  3),
  ('Dar Express',           'Peter Dlamini', 'fleet@darexpress.com',        '+258864567890', 'MZ', 'inactive', 300,  1),
  ('SADC Prime',            'Grace Mutasa',  'fleet@sadcprime.com',         '+265994567890', 'MW', 'active',   2900, 10),
  ('Pan-African Co',        'David Nkosi',   'fleet@panafrican.com',        '+264824567890', 'NA', 'active',   4000, 14);

-- ─── SIM CARDS (subset — 30 rows shown, extend to 80 for full dataset) ──────
INSERT INTO sim_cards (sim_number, iccid, network_provider, assigned_vehicle, activation_date, last_communication, market) VALUES
  ('263772100001', '89266480000000000001', 'Econet',            'ZW-123-A', CURRENT_DATE - 180, now() - INTERVAL '5 minutes',   'ZW'),
  ('263772100002', '89266480000000000002', 'Econet',            'ZW-456-B', CURRENT_DATE - 150, now() - INTERVAL '45 minutes',  'ZW'),
  ('263712100003', '89266480000000000003', 'NetOne',            'ZW-789-C', CURRENT_DATE - 200, now() - INTERVAL '2 hours',     'ZW'),
  ('263732100004', '89266480000000000004', 'Telecel',           'ZW-321-D', CURRENT_DATE - 90,  now() - INTERVAL '2 days',      'ZW'),
  ('263772100005', '89266480000000000005', 'Econet',            NULL,        CURRENT_DATE - 220, now() - INTERVAL '60 days',     'ZW'),
  ('260961100006', '89266450000000000006', 'MTN Zambia',        'ZM-111-A', CURRENT_DATE - 160, now() - INTERVAL '30 minutes',  'ZM'),
  ('260971100007', '89266450000000000007', 'Airtel Zambia',     'ZM-222-B', CURRENT_DATE - 140, now() - INTERVAL '3 hours',     'ZM'),
  ('260961100008', '89266450000000000008', 'MTN Zambia',        'ZM-333-C', CURRENT_DATE - 100, now() - INTERVAL '5 days',      'ZM'),
  ('260971100009', '89266450000000000009', 'Airtel Zambia',     NULL,        CURRENT_DATE - 180, NULL,                           'ZM'),
  ('267711100010', '89266520000000000010', 'Mascom',            'BW-100-A', CURRENT_DATE - 170, now() - INTERVAL '15 minutes',  'BW'),
  ('267721100011', '89266520000000000011', 'Orange Botswana',   'BW-200-B', CURRENT_DATE - 130, now() - INTERVAL '6 hours',     'BW'),
  ('267711100012', '89266520000000000012', 'Mascom',            'BW-300-C', CURRENT_DATE - 110, now() - INTERVAL '10 days',     'BW'),
  ('267731100013', '89266520000000000013', 'BTC',               NULL,        CURRENT_DATE - 200, now() - INTERVAL '45 days',     'BW'),
  ('258841100014', '89266430000000000014', 'Vodacom Mozambique','MZ-410-A', CURRENT_DATE - 150, now() - INTERVAL '1 hour',      'MZ'),
  ('258861100015', '89266430000000000015', 'Movitel',           'MZ-420-B', CURRENT_DATE - 120, now() - INTERVAL '8 hours',     'MZ'),
  ('258841100016', '89266430000000000016', 'Vodacom Mozambique','MZ-430-C', CURRENT_DATE - 95,  now() - INTERVAL '3 days',      'MZ'),
  ('258861100017', '89266430000000000017', 'Movitel',           NULL,        CURRENT_DATE - 210, now() - INTERVAL '75 days',     'MZ'),
  ('265991100018', '89266500000000000018', 'TNM',               'MW-510-A', CURRENT_DATE - 140, now() - INTERVAL '20 minutes',  'MW'),
  ('265981100019', '89266500000000000019', 'Airtel Malawi',     'MW-520-B', CURRENT_DATE - 120, now() - INTERVAL '36 hours',    'MW'),
  ('265991100020', '89266500000000000020', 'TNM',               NULL,        CURRENT_DATE - 160, NULL,                           'MW'),
  ('264811100021', '89266490000000000021', 'MTC Namibia',       'NA-610-A', CURRENT_DATE - 130, now() - INTERVAL '10 hours',    'NA'),
  ('264811100022', '89266490000000000022', 'MTC Namibia',       'NA-620-B', CURRENT_DATE - 100, now() - INTERVAL '7 days',      'NA'),
  ('264851100023', '89266490000000000023', 'TN Mobile',         NULL,        CURRENT_DATE - 180, now() - INTERVAL '40 days',     'NA'),
  ('27821100024',  '89266550000000000024', 'Vodacom',           'ZA-710-A', CURRENT_DATE - 150, now() - INTERVAL '2 minutes',   'ZA'),
  ('27831100025',  '89266550000000000025', 'MTN',               'ZA-720-B', CURRENT_DATE - 170, now() - INTERVAL '5 hours',     'ZA'),
  ('27821100026',  '89266550000000000026', 'Vodacom',           'ZA-730-C', CURRENT_DATE - 90,  now() - INTERVAL '20 days',     'ZA'),
  ('27841100027',  '89266550000000000027', 'Cell C',            NULL,        CURRENT_DATE - 220, now() - INTERVAL '100 days',    'ZA'),
  ('255751100028', '89266400000000000028', 'Vodacom Tanzania',  'TZ-810-A', CURRENT_DATE - 160, now() - INTERVAL '12 hours',    'TZ'),
  ('255781100029', '89266400000000000029', 'Airtel Tanzania',   'TZ-820-B', CURRENT_DATE - 120, now() - INTERVAL '28 days',     'TZ'),
  ('255711100030', '89266400000000000030', 'Tigo',              NULL,        CURRENT_DATE - 250, now() - INTERVAL '200 days',    'TZ');

-- ─── SIM STATUS HISTORY (30-day backfill) ──────────────────────────────────
INSERT INTO sim_status_history (snapshot_date, total_count, active_count, offline_count, dormant_count)
SELECT
  CURRENT_DATE - d                  AS snapshot_date,
  30                                AS total_count,
  (12 + floor(random() * 5))::INT   AS active_count,
  (8  + floor(random() * 4))::INT   AS offline_count,
  30 - (12 + floor(random() * 5))::INT - (8 + floor(random() * 4))::INT AS dormant_count
FROM generate_series(1, 30) AS d
ON CONFLICT (snapshot_date) DO NOTHING;

-- Capture today's real snapshot
SELECT capture_daily_sim_snapshot();

-- ─── SEED USERS ────────────────────────────────────────────────────────────
INSERT INTO users (email, full_name, role, is_active) VALUES
  ('admin@bantutrack.com',      'Super Admin',       'super_admin',        TRUE),
  ('ops@bantutrack.com',        'Operations Manager','operations_manager',  TRUE),
  ('analyst@bantutrack.com',    'Fleet Analyst',     'analyst',            TRUE),
  ('support@bantutrack.com',    'Customer Support',  'customer_support',   TRUE);

-- =====================================================================
-- END OF SAMPLE DATA
-- =====================================================================
