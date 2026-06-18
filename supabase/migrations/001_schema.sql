-- =====================================================================
-- AFIS Fleet Intelligence System — Complete Database Schema
-- Bantu Track Pvt Ltd | Production Schema v2.5
-- Deploy order: 001_schema.sql → 002_sample_data.sql
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ─────────────────────────────────────────────────────────────────

CREATE TYPE sim_status_enum      AS ENUM ('active', 'offline', 'dormant');
CREATE TYPE vehicle_status_enum  AS ENUM ('moving', 'idling', 'stopped', 'offline');
CREATE TYPE device_health_enum   AS ENUM ('healthy', 'warning', 'critical');
CREATE TYPE device_status_enum   AS ENUM ('installed', 'uninstalled', 'faulty', 'retired');
CREATE TYPE risk_level_enum      AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE alert_severity_enum  AS ENUM ('info', 'warning', 'critical');
CREATE TYPE customer_status_enum AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE user_role_enum       AS ENUM ('super_admin', 'operations_manager', 'analyst', 'customer_support');
CREATE TYPE market_code_enum     AS ENUM ('ZW', 'ZM', 'BW', 'MZ', 'MW', 'NA', 'ZA', 'TZ');
CREATE TYPE report_type_enum     AS ENUM (
  'daily-fleet-summary', 'driver-behaviour', 'fleet-efficiency',
  'predictive-maintenance', 'risk-assessment', 'fuel-fraud',
  'compliance', 'sim-health', 'executive-summary',
  'cost-savings', 'route-optimization', 'market-benchmark'
);

-- ─── CUSTOMERS ─────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name     VARCHAR(200) NOT NULL,
  contact_person   VARCHAR(100),
  email            VARCHAR(200) UNIQUE,
  phone            VARCHAR(30),
  market           market_code_enum NOT NULL,
  status           customer_status_enum NOT NULL DEFAULT 'active',
  monthly_revenue  NUMERIC(10, 2) DEFAULT 0,
  vehicle_count    INT DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_market  ON customers(market);
CREATE INDEX idx_customers_status  ON customers(status);

-- ─── TRACKING DEVICES ──────────────────────────────────────────────────────

CREATE TABLE tracking_devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_code   VARCHAR(20) NOT NULL UNIQUE,   -- e.g. DEV-0001
  imei          VARCHAR(20) NOT NULL UNIQUE,
  model         VARCHAR(100),
  status        device_status_enum NOT NULL DEFAULT 'uninstalled',
  health        device_health_enum NOT NULL DEFAULT 'healthy',
  firmware      VARCHAR(30),
  market        market_code_enum,
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_status  ON tracking_devices(status);
CREATE INDEX idx_devices_health  ON tracking_devices(health);
CREATE INDEX idx_devices_market  ON tracking_devices(market);

-- ─── SIM CARDS ─────────────────────────────────────────────────────────────

CREATE TABLE sim_cards (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sim_number           VARCHAR(20) NOT NULL UNIQUE,
  iccid                VARCHAR(25) NOT NULL UNIQUE,
  network_provider     VARCHAR(100) NOT NULL,
  assigned_vehicle     VARCHAR(20),    -- vehicle registration
  assigned_tracker     VARCHAR(20),    -- device_code reference
  activation_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  last_communication   TIMESTAMPTZ,
  status               sim_status_enum NOT NULL DEFAULT 'active',
  market               market_code_enum NOT NULL,
  data_usage_mb        NUMERIC(10, 2) DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sim_cards_status        ON sim_cards(status);
CREATE INDEX idx_sim_cards_market        ON sim_cards(market);
CREATE INDEX idx_sim_cards_last_comm     ON sim_cards(last_communication);
-- Composite index for the status refresh query
CREATE INDEX idx_sim_status_lastcomm     ON sim_cards(status, last_communication);

-- Status classification function (mirrors the SIM Management Module)
CREATE OR REPLACE FUNCTION calculate_sim_status(
  p_last_communication TIMESTAMPTZ,
  p_activation_date    DATE
) RETURNS sim_status_enum
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  effective_time TIMESTAMPTZ;
BEGIN
  effective_time := COALESCE(p_last_communication, p_activation_date::TIMESTAMPTZ);
  IF    effective_time >= now() - INTERVAL '24 hours'  THEN RETURN 'active';
  ELSIF effective_time >= now() - INTERVAL '30 days'   THEN RETURN 'offline';
  ELSE                                                       RETURN 'dormant';
  END IF;
END;
$$;

-- Trigger: recalculate status on every write
CREATE OR REPLACE FUNCTION trg_sim_cards_status_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.status     := calculate_sim_status(NEW.last_communication, NEW.activation_date);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sim_cards_status
  BEFORE INSERT OR UPDATE ON sim_cards
  FOR EACH ROW EXECUTE FUNCTION trg_sim_cards_status_fn();

-- ─── VEHICLES ──────────────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration     VARCHAR(20) NOT NULL UNIQUE,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  device_id        UUID REFERENCES tracking_devices(id) ON DELETE SET NULL,
  make             VARCHAR(50),
  model_name       VARCHAR(50),
  year             INT,
  status           vehicle_status_enum NOT NULL DEFAULT 'stopped',
  market           market_code_enum NOT NULL,
  risk_level       risk_level_enum NOT NULL DEFAULT 'Low',
  driver_name      VARCHAR(100),
  speed_kmh        NUMERIC(5, 1) DEFAULT 0,
  odometer_km      INT DEFAULT 0,
  fuel_pct         INT DEFAULT 100 CHECK (fuel_pct BETWEEN 0 AND 100),
  battery_v        NUMERIC(4, 2),
  lat              NUMERIC(10, 7),
  lng              NUMERIC(10, 7),
  last_seen        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_status   ON vehicles(status);
CREATE INDEX idx_vehicles_market   ON vehicles(market);
CREATE INDEX idx_vehicles_risk     ON vehicles(risk_level);

-- ─── ACTIVITY LOGS (SIM heartbeats) ────────────────────────────────────────

CREATE TABLE activity_logs (
  id                 BIGSERIAL PRIMARY KEY,
  sim_id             UUID NOT NULL REFERENCES sim_cards(id) ON DELETE CASCADE,
  communication_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_usage_mb      NUMERIC(8, 3) DEFAULT 0,
  location           TEXT,   -- lat,lng string for now; point type in production
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_sim_time ON activity_logs(sim_id, communication_time DESC);
CREATE INDEX idx_activity_time     ON activity_logs(communication_time DESC);

-- Trigger: push new comm_time onto sim_cards → re-fires status trigger
CREATE OR REPLACE FUNCTION trg_activity_log_after_insert_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sim_cards
  SET    last_communication = NEW.communication_time
  WHERE  id = NEW.sim_id
    AND  (last_communication IS NULL OR NEW.communication_time > last_communication);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_after_insert
  AFTER INSERT ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION trg_activity_log_after_insert_fn();

-- ─── SIM STATUS HISTORY (daily rollup for trend charts) ────────────────────

CREATE TABLE sim_status_history (
  id             BIGSERIAL PRIMARY KEY,
  snapshot_date  DATE NOT NULL UNIQUE,
  total_count    INT NOT NULL DEFAULT 0,
  active_count   INT NOT NULL DEFAULT 0,
  offline_count  INT NOT NULL DEFAULT 0,
  dormant_count  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── VEHICLE TRIPS ─────────────────────────────────────────────────────────

CREATE TABLE vehicle_trips (
  id              BIGSERIAL PRIMARY KEY,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_name     VARCHAR(100),
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  distance_km     NUMERIC(8, 2) DEFAULT 0,
  max_speed_kmh   NUMERIC(5, 1) DEFAULT 0,
  avg_speed_kmh   NUMERIC(5, 1) DEFAULT 0,
  harsh_braking   INT DEFAULT 0,
  harsh_accel     INT DEFAULT 0,
  idle_minutes    INT DEFAULT 0,
  fuel_used_l     NUMERIC(6, 2) DEFAULT 0,
  start_location  TEXT,
  end_location    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_vehicle ON vehicle_trips(vehicle_id);
CREATE INDEX idx_trips_time    ON vehicle_trips(start_time DESC);

-- ─── ALERTS ────────────────────────────────────────────────────────────────

CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type    VARCHAR(30) NOT NULL,
  severity      alert_severity_enum NOT NULL,
  description   TEXT NOT NULL,
  vehicle_id    UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  sim_id        UUID REFERENCES sim_cards(id) ON DELETE SET NULL,
  device_id     UUID REFERENCES tracking_devices(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  market        market_code_enum,
  metadata      JSONB DEFAULT '{}',
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID,   -- references users table (added below)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_severity   ON alerts(severity);
CREATE INDEX idx_alerts_resolved   ON alerts(resolved);
CREATE INDEX idx_alerts_created    ON alerts(created_at DESC);
CREATE INDEX idx_alerts_vehicle    ON alerts(vehicle_id);

-- ─── AI REPORTS ────────────────────────────────────────────────────────────

CREATE TABLE ai_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type      report_type_enum NOT NULL,
  title            VARCHAR(200) NOT NULL,
  generated_by     UUID,   -- user id
  period_start     DATE,
  period_end       DATE,
  summary          TEXT,
  key_findings     JSONB DEFAULT '[]',
  recommendations  JSONB DEFAULT '[]',
  risk_indicators  JSONB DEFAULT '[]',
  full_content     TEXT,
  export_url       TEXT,
  market           market_code_enum,   -- NULL = all markets
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_reports_type    ON ai_reports(report_type);
CREATE INDEX idx_ai_reports_created ON ai_reports(created_at DESC);

-- ─── USERS ─────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(200) NOT NULL UNIQUE,
  full_name     VARCHAR(100),
  role          user_role_enum NOT NULL DEFAULT 'customer_support',
  market        market_code_enum,   -- NULL = all markets
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUDIT LOG ─────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  table_name  VARCHAR(50) NOT NULL,
  record_id   UUID,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_table   ON audit_log(table_name);
CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ─── VIEWS ─────────────────────────────────────────────────────────────────

-- SIM dashboard KPIs
CREATE OR REPLACE VIEW v_sim_dashboard_stats AS
SELECT
  COUNT(*)                                                            AS total_sims,
  COUNT(*) FILTER (WHERE status = 'active')                          AS active_sims,
  COUNT(*) FILTER (WHERE status = 'offline')                         AS offline_sims,
  COUNT(*) FILTER (WHERE status = 'dormant')                         AS dormant_sims,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'active')  / NULLIF(COUNT(*), 0), 2) AS active_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'offline') / NULLIF(COUNT(*), 0), 2) AS offline_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'dormant') / NULLIF(COUNT(*), 0), 2) AS dormant_pct,
  now() AS generated_at
FROM sim_cards;

-- SIM status distribution
CREATE OR REPLACE VIEW v_sim_status_distribution AS
SELECT status, COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
FROM sim_cards GROUP BY status;

-- Recently active SIMs (last 24h)
CREATE OR REPLACE VIEW v_recently_active_sims AS
SELECT s.*, al.communication_time AS latest_comm
FROM sim_cards s
JOIN LATERAL (
  SELECT communication_time FROM activity_logs
  WHERE sim_id = s.id ORDER BY communication_time DESC LIMIT 1
) al ON TRUE
WHERE s.status = 'active'
ORDER BY al.communication_time DESC;

-- Offline SIMs needing attention (sorted by longest-offline first)
CREATE OR REPLACE VIEW v_offline_sims_attention AS
SELECT *,
  EXTRACT(EPOCH FROM (now() - last_communication)) / 3600 AS hours_offline
FROM sim_cards
WHERE status = 'offline'
ORDER BY last_communication ASC NULLS LAST;

-- Dormant SIMs
CREATE OR REPLACE VIEW v_dormant_sims AS
SELECT *,
  EXTRACT(EPOCH FROM (now() - COALESCE(last_communication, activation_date::TIMESTAMPTZ))) / 86400 AS days_dormant
FROM sim_cards WHERE status = 'dormant'
ORDER BY last_communication ASC NULLS LAST;

-- Daily active SIM trend (last 30 days from activity_logs)
CREATE OR REPLACE VIEW v_daily_active_trend AS
SELECT
  DATE(communication_time) AS comm_date,
  COUNT(DISTINCT sim_id)   AS active_sims
FROM activity_logs
WHERE communication_time >= now() - INTERVAL '30 days'
GROUP BY DATE(communication_time)
ORDER BY comm_date;

-- 30-day status trend from history table
CREATE OR REPLACE VIEW v_status_trend_30d AS
SELECT * FROM sim_status_history
WHERE snapshot_date >= CURRENT_DATE - 30
ORDER BY snapshot_date;

-- Fleet dashboard stats
CREATE OR REPLACE VIEW v_fleet_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM vehicles)                                    AS total_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE status != 'offline')         AS active_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'moving')           AS moving_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'offline')          AS offline_vehicles,
  (SELECT COUNT(*) FROM tracking_devices)                           AS total_devices,
  (SELECT COUNT(*) FROM tracking_devices WHERE status = 'installed') AS installed_devices,
  (SELECT COUNT(*) FROM tracking_devices WHERE health = 'healthy')  AS healthy_devices,
  (SELECT COUNT(*) FROM customers WHERE status = 'active')          AS active_customers,
  (SELECT COUNT(*) FROM alerts WHERE resolved = FALSE AND severity = 'critical') AS critical_alerts,
  now() AS generated_at;

-- ─── RPC FUNCTIONS ─────────────────────────────────────────────────────────

-- JSON KPI blob for AI integration
CREATE OR REPLACE FUNCTION get_sim_dashboard_stats()
RETURNS JSON LANGUAGE SQL STABLE AS $$
  SELECT row_to_json(t) FROM v_sim_dashboard_stats t;
$$;

-- Refresh all SIM statuses (called by pg_cron every 15 min)
CREATE OR REPLACE FUNCTION refresh_all_sim_statuses()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE sim_cards
    SET status = calculate_sim_status(last_communication, activation_date),
        updated_at = now()
    WHERE status != calculate_sim_status(last_communication, activation_date)
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  RETURN updated_count;
END;
$$;

-- Capture daily snapshot for trend charts
CREATE OR REPLACE FUNCTION capture_daily_sim_snapshot()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sim_status_history (snapshot_date, total_count, active_count, offline_count, dormant_count)
  SELECT
    CURRENT_DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'offline'),
    COUNT(*) FILTER (WHERE status = 'dormant')
  FROM sim_cards
  ON CONFLICT (snapshot_date) DO UPDATE
    SET total_count   = EXCLUDED.total_count,
        active_count  = EXCLUDED.active_count,
        offline_count = EXCLUDED.offline_count,
        dormant_count = EXCLUDED.dormant_count;
END;
$$;

-- ─── ROW-LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_devices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (for server-side operations)
CREATE POLICY "service_role_all" ON customers         FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON vehicles          FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON sim_cards         FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON tracking_devices  FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON alerts            FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON ai_reports        FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all" ON users             FOR ALL TO service_role USING (TRUE);

-- Authenticated read access
CREATE POLICY "auth_read" ON customers         FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read" ON vehicles          FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read" ON sim_cards         FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read" ON tracking_devices  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read" ON alerts            FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "auth_read" ON ai_reports        FOR SELECT TO authenticated USING (TRUE);

-- ─── pg_cron SCHEDULES (uncomment after enabling pg_cron extension) ─────────

-- Refresh SIM statuses every 15 minutes
-- SELECT cron.schedule('refresh-sim-statuses', '*/15 * * * *', 'SELECT refresh_all_sim_statuses()');

-- Capture daily snapshot at midnight UTC
-- SELECT cron.schedule('daily-sim-snapshot', '0 0 * * *', 'SELECT capture_daily_sim_snapshot()');

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
