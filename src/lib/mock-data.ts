// ─── Mock Data ─────────────────────────────────────────────────────────────
// Full enterprise dataset for the AFIS platform demo.
// Covers: SIM cards, vehicles, tracking devices, customers, alerts, AI reports.

export const MARKETS = ["ZW", "ZM", "BW", "MZ", "MW", "NA", "ZA", "TZ"]
export const PROVIDERS: Record<string, string[]> = {
  ZW: ["Econet", "NetOne", "Telecel"],
  ZM: ["MTN Zambia", "Airtel Zambia", "Zamtel"],
  BW: ["Mascom", "Orange Botswana", "BTC"],
  MZ: ["Vodacom Mozambique", "Movitel", "Tmcel"],
  MW: ["TNM", "Airtel Malawi"],
  NA: ["MTC Namibia", "TN Mobile"],
  ZA: ["Vodacom", "MTN", "Cell C", "Telkom"],
  TZ: ["Vodacom Tanzania", "Airtel Tanzania", "Tigo"],
}

export const MARKET_COORDS: Record<string, [number, number]> = {
  ZW: [-17.8252, 31.0335],
  ZM: [-15.3875, 28.3228],
  BW: [-24.6282, 25.9231],
  MZ: [-25.9692, 32.5732],
  MW: [-13.9626, 33.7741],
  NA: [-22.5594, 17.0832],
  ZA: [-26.2041, 28.0473],
  TZ: [-6.7924, 39.2083],
}

export const MARKET_NAMES: Record<string, string> = {
  ZW: "Zimbabwe",
  ZM: "Zambia",
  BW: "Botswana",
  MZ: "Mozambique",
  MW: "Malawi",
  NA: "Namibia",
  ZA: "South Africa",
  TZ: "Tanzania",
}

function randBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a
}

function pastDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function pastHours(hours: number): Date {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d
}

// ─── Customers (30) ────────────────────────────────────────────────────────
const COMPANY_NAMES = [
  "Zimtrucks Ltd", "Zamfreight Co", "Botswana Cargo", "Mozambique Trans",
  "Malawi Movers", "Namibia Fleet", "SA Logistics", "Tanzania Transport",
  "SADC Carriers", "Cross-Border Co", "AfriFleet Inc", "Bantu Logistics",
  "Southern Fleet", "EastAfrica Trans", "Great Lakes Co", "Kalahari Freight",
  "Zambezi Cargo", "Limpopo Trans", "Victoria Fleet", "Kilimanjaro Co",
  "Harare Haulage", "Lusaka Express", "Gaborone Trans", "Maputo Movers",
  "Lilongwe Logistics", "Windhoek Fleet", "Joburg Carriers", "Dar Express",
  "SADC Prime", "Pan-African Co",
]

export const CUSTOMERS = COMPANY_NAMES.map((name, i) => ({
  id: `CUST-${String(i + 1).padStart(3, "0")}`,
  company_name: name,
  contact_person: ["John Moyo", "Mary Banda", "Peter Dlamini", "Grace Mutasa", "David Nkosi"][i % 5],
  email: `fleet@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
  phone: `+${26 + (i % 8)}${randBetween(70, 79)}${randBetween(1000000, 9999999)}`,
  market: MARKETS[i % 8],
  vehicle_count: randBetween(2, 25),
  status: i < 25 ? "active" : "inactive",
  joined: pastDate(randBetween(60, 720)),
  monthly_revenue: randBetween(500, 8000),
}))

// ─── Tracking Devices (80) ─────────────────────────────────────────────────
const DEVICE_MODELS = ["GT06N", "Concox AT4", "Teltonika FMB920", "Ruptela FM-Eco4", "Coban GPS303"]
export const TRACKING_DEVICES = Array.from({ length: 80 }, (_, i) => {
  const health = i < 60 ? "healthy" : i < 72 ? "warning" : "critical"
  return {
    id: `DEV-${String(i + 1).padStart(4, "0")}`,
    imei: `86${String(randBetween(100000000000, 999999999999))}`,
    model: DEVICE_MODELS[i % 5],
    status: i < 68 ? "installed" : "uninstalled",
    health,
    last_seen: health === "critical" ? pastDate(randBetween(31, 90)) : health === "warning" ? pastHours(randBetween(25, 72)) : pastHours(randBetween(0, 2)),
    firmware: `v${2 + (i % 3)}.${randBetween(0, 9)}.${randBetween(0, 15)}`,
    market: MARKETS[i % 8],
  }
})

// ─── Vehicles (68) ─────────────────────────────────────────────────────────
const STATUSES = ["moving", "moving", "moving", "idling", "stopped", "offline"]
export const VEHICLES = Array.from({ length: 68 }, (_, i) => {
  const market = MARKETS[i % 8]
  const status = STATUSES[i % 6]
  const custIdx = i % CUSTOMERS.length
  const devIdx = i < 68 ? i : i % 68
  return {
    id: `VEH-${String(i + 1).padStart(4, "0")}`,
    registration: `${market}-${String(randBetween(100, 999))}-${String.fromCharCode(65 + (i % 26))}`,
    customer_id: CUSTOMERS[custIdx].id,
    customer_name: CUSTOMERS[custIdx].company_name,
    device_id: TRACKING_DEVICES[devIdx].id,
    make: ["Toyota", "Ford", "Isuzu", "Mercedes", "Volvo", "MAN", "DAF"][i % 7],
    model: ["Hilux", "Ranger", "D-Max", "Actros", "FH16", "TGX", "XF"][i % 7],
    year: 2018 + (i % 6),
    status,
    market,
    coords: [
      MARKET_COORDS[market][0] + (Math.random() - 0.5) * 2,
      MARKET_COORDS[market][1] + (Math.random() - 0.5) * 2,
    ] as [number, number],
    speed: status === "moving" ? randBetween(40, 110) : 0,
    risk: ["Low", "Low", "Medium", "High"][i % 4],
    driver: ["J. Moyo", "M. Banda", "P. Dlamini", "G. Mutasa", "D. Nkosi", "F. Chirwa", "A. Sithole"][i % 7],
    odometer: randBetween(15000, 280000),
    last_seen: status === "offline" ? pastHours(randBetween(25, 200)) : pastHours(randBetween(0, 1)),
    fuel: randBetween(15, 100),
    battery: randBetween(60, 100),
  }
})

// ─── SIM Cards (80) ────────────────────────────────────────────────────────
export const SIM_CARDS = Array.from({ length: 80 }, (_, i) => {
  const market = MARKETS[i % 8]
  const providers = PROVIDERS[market]
  const daysAgo = i < 30 ? randBetween(0, 1) : i < 55 ? randBetween(2, 29) : randBetween(30, 200)
  const status = daysAgo === 0 || (daysAgo === 1 && Math.random() > 0.3) ? "active" : daysAgo < 30 ? "offline" : "dormant"
  const veh = i < 68 ? VEHICLES[i] : null
  return {
    id: `SIM-${String(i + 1).padStart(4, "0")}`,
    sim_number: `2${6 + (i % 8)}${String(randBetween(70, 79))}${String(randBetween(1000000, 9999999))}`,
    iccid: `89266${String(i + 1).padStart(14, "0")}`,
    network_provider: providers[i % providers.length],
    assigned_vehicle: veh?.registration ?? null,
    assigned_tracker: veh?.device_id ?? null,
    activation_date: pastDate(randBetween(60, 720)),
    last_communication: daysAgo === 0 ? pastHours(randBetween(0, 23)) : daysAgo < 30 ? pastDate(daysAgo) : pastDate(daysAgo),
    status,
    market,
    data_usage: randBetween(50, 4000),
  }
})

// Stats
const activeSims = SIM_CARDS.filter((s) => s.status === "active").length
const offlineSims = SIM_CARDS.filter((s) => s.status === "offline").length
const dormantSims = SIM_CARDS.filter((s) => s.status === "dormant").length
const activeVehicles = VEHICLES.filter((v) => v.status !== "offline").length
const installedDevices = TRACKING_DEVICES.filter((d) => d.status === "installed").length

export const KPI_STATS = {
  total_sims: SIM_CARDS.length,
  active_sims: activeSims,
  offline_sims: offlineSims,
  dormant_sims: dormantSims,
  active_vehicles: activeVehicles,
  inactive_vehicles: VEHICLES.length - activeVehicles,
  total_vehicles: VEHICLES.length,
  installed_units: installedDevices,
  uninstalled_units: TRACKING_DEVICES.length - installedDevices,
  total_devices: TRACKING_DEVICES.length,
  customers: CUSTOMERS.length,
  active_customers: CUSTOMERS.filter((c) => c.status === "active").length,
  device_health_pct: Math.round((TRACKING_DEVICES.filter((d) => d.health === "healthy").length / TRACKING_DEVICES.length) * 100),
  fleet_utilization_pct: Math.round((VEHICLES.filter((v) => v.status === "moving").length / VEHICLES.length) * 100),
}

// ─── Alerts (48) ───────────────────────────────────────────────────────────
const ALERT_TYPES = [
  { type: "offline", severity: "critical", desc: "Device offline > 24 hours" },
  { type: "dormant", severity: "critical", desc: "SIM dormant > 30 days" },
  { type: "speeding", severity: "warning", desc: "Speed limit exceeded" },
  { type: "geofence", severity: "warning", desc: "Geofence breach detected" },
  { type: "harsh", severity: "warning", desc: "Harsh braking event" },
  { type: "fuel", severity: "warning", desc: "Unusual fuel consumption" },
  { type: "maintenance", severity: "info", desc: "Service due in 500 km" },
  { type: "preincident", severity: "critical", desc: "Pre-incident warning" },
]

export const ALERTS = Array.from({ length: 48 }, (_, i) => {
  const tmpl = ALERT_TYPES[i % ALERT_TYPES.length]
  const veh = VEHICLES[i % VEHICLES.length]
  return {
    id: `ALT-${String(i + 1).padStart(4, "0")}`,
    alert_type: tmpl.type,
    severity: tmpl.severity,
    description: tmpl.desc,
    vehicle: veh.registration,
    driver: veh.driver,
    market: veh.market,
    created_at: pastHours(randBetween(0, 72)),
    resolved: i > 20,
  }
})

// ─── 30-day trend data ─────────────────────────────────────────────────────
export function buildTrend30() {
  const labels: string[] = []
  const active: number[] = []
  const offline: number[] = []
  const dormant: number[] = []
  const vehicles: number[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }))
    const a = i === 0 ? activeSims : 28 + Math.round(Math.sin(i / 3) * 4)
    const o = i === 0 ? offlineSims : 18 + Math.round(Math.cos(i / 4) * 3)
    active.push(a)
    offline.push(o)
    dormant.push(Math.max(0, SIM_CARDS.length - a - o))
    vehicles.push(i === 0 ? activeVehicles : activeVehicles - randBetween(-3, 3))
  }
  return { labels, active, offline, dormant, vehicles }
}

export function buildTrend14() {
  const labels: string[] = []
  const values: number[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }))
    values.push(i === 0 ? activeVehicles : activeVehicles - Math.round(Math.sin(i / 2) * 5))
  }
  return { labels, values }
}

// ─── AI Report Templates ───────────────────────────────────────────────────
export const AI_REPORTS = [
  {
    id: "daily-fleet-summary",
    title: "Daily Fleet Summary",
    category: "Operational Intelligence",
    freq: "DAILY",
    icon: "dash",
    description: "Complete daily operational overview of all fleet assets",
  },
  {
    id: "driver-behaviour",
    title: "Driver Behaviour Analysis",
    category: "Operational Intelligence",
    freq: "DAILY",
    icon: "drv",
    description: "Individual driver safety scores, harsh events, and coaching recommendations",
  },
  {
    id: "fleet-efficiency",
    title: "Fleet Efficiency Report",
    category: "Operational Intelligence",
    freq: "WEEKLY",
    icon: "util",
    description: "Fuel usage, utilization rates, idle time, and cost-per-km analysis",
  },
  {
    id: "predictive-maintenance",
    title: "Predictive Maintenance Forecast",
    category: "Operational Intelligence",
    freq: "WEEKLY",
    icon: "wrench",
    description: "ML-based predictions for component failures and service requirements",
  },
  {
    id: "risk-assessment",
    title: "Risk Assessment Report",
    category: "Risk & Compliance",
    freq: "DAILY",
    icon: "risk",
    description: "Fleet-wide risk scoring, Pre-Incident Warnings, and ELC calculations",
  },
  {
    id: "fuel-fraud",
    title: "Fuel Fraud & Anomaly Detection",
    category: "Risk & Compliance",
    freq: "WEEKLY",
    icon: "fuel",
    description: "Statistical anomalies in fuel consumption, drain detection",
  },
  {
    id: "compliance",
    title: "Compliance & Regulatory Report",
    category: "Risk & Compliance",
    freq: "MONTHLY",
    icon: "shield",
    description: "AFIS-FSI compliance status, regulatory adherence across SADC markets",
  },
  {
    id: "sim-health",
    title: "SIM & Connectivity Health",
    category: "Risk & Compliance",
    freq: "DAILY",
    icon: "off",
    description: "Active, offline, and dormant SIM analysis with recovery recommendations",
  },
  {
    id: "executive-summary",
    title: "Executive Summary",
    category: "Strategic & Financial",
    freq: "MONTHLY",
    icon: "exec",
    description: "Board-level fleet performance overview with strategic insights",
  },
  {
    id: "cost-savings",
    title: "Cost-Saving Opportunities",
    category: "Strategic & Financial",
    freq: "MONTHLY",
    icon: "spark",
    description: "Identified savings in fuel, maintenance, and route optimization",
  },
  {
    id: "route-optimization",
    title: "Route & Network Optimisation",
    category: "Strategic & Financial",
    freq: "WEEKLY",
    icon: "route",
    description: "Corridor analysis, detour identification, and route efficiency scoring",
  },
  {
    id: "market-benchmark",
    title: "Market Benchmark Report",
    category: "Strategic & Financial",
    freq: "MONTHLY",
    icon: "util",
    description: "Cross-market performance comparison across all 8 SADC regions",
  },
]

export function generateAIReport(reportId: string): string {
  const kpi = KPI_STATS
  const criticalAlerts = ALERTS.filter((a) => a.severity === "critical" && !a.resolved).length
  const dormantPct = ((kpi.dormant_sims / kpi.total_sims) * 100).toFixed(1)
  const offlinePct = ((kpi.offline_sims / kpi.total_sims) * 100).toFixed(1)
  const utilizationPct = kpi.fleet_utilization_pct

  const reports: Record<string, string> = {
    "daily-fleet-summary": `## Daily Fleet Summary — ${new Date().toLocaleDateString("en-GB", { dateStyle: "full" })}

**Executive Overview**

The AFIS fleet recorded ${kpi.active_vehicles} active vehicles out of ${kpi.total_vehicles} deployed units today, representing a ${utilizationPct}% fleet utilization rate. ${criticalAlerts} critical alerts require immediate attention from operations teams.

**SIM Card Status**
- Active SIMs: ${kpi.active_sims} (${((kpi.active_sims / kpi.total_sims) * 100).toFixed(1)}% of fleet)
- Offline SIMs: ${kpi.offline_sims} — require investigation within 24 hours
- Dormant SIMs: ${kpi.dormant_sims} — ${dormantPct}% of fleet silent for 30+ days

**Vehicle Activity**
- Moving: ${VEHICLES.filter((v) => v.status === "moving").length} vehicles
- Idling: ${VEHICLES.filter((v) => v.status === "idling").length} vehicles (fuel cost concern)
- Stopped: ${VEHICLES.filter((v) => v.status === "stopped").length} vehicles
- Offline: ${VEHICLES.filter((v) => v.status === "offline").length} vehicles

**Device Health**
- Overall health score: ${kpi.device_health_pct}%
- ${TRACKING_DEVICES.filter((d) => d.health === "critical").length} devices in critical state — immediate replacement recommended

**Top Priority Actions**
1. Investigate ${kpi.offline_sims} offline SIM cards — several have been silent for 24-48 hours
2. Review ${VEHICLES.filter((v) => v.status === "idling").length} idling vehicles — estimated fuel waste: $${(VEHICLES.filter((v) => v.status === "idling").length * 12.5).toFixed(0)}/day
3. Escalate ${TRACKING_DEVICES.filter((d) => d.health === "critical").length} critical device failures to maintenance team`,

    "sim-health": `## SIM Card & Connectivity Health Report

**Generated:** ${new Date().toLocaleString("en-GB")}

**Fleet Connectivity Summary**

Of the ${kpi.total_sims} SIM cards deployed across the SADC fleet, ${kpi.active_sims} (${((kpi.active_sims / kpi.total_sims) * 100).toFixed(1)}%) are actively communicating within the last 24 hours. This represents a healthy connectivity baseline, though ${offlinePct}% of SIMs are in the offline band and require attention.

**Status Breakdown by Market**
${MARKETS.map((m) => {
  const mSims = SIM_CARDS.filter((s) => s.market === m)
  const mActive = mSims.filter((s) => s.status === "active").length
  return `- ${MARKET_NAMES[m]}: ${mActive}/${mSims.length} active (${mSims.length > 0 ? ((mActive / mSims.length) * 100).toFixed(0) : 0}%)`
}).join("\n")}

**Dormant SIM Risk Assessment**

${kpi.dormant_sims} SIMs have been silent for 30+ days. This represents a **${dormantPct}% dormancy rate** — above the recommended 10% threshold. Dormant SIMs incur ongoing subscription costs without delivering telemetry value.

**Recommendations**
1. **Immediate:** Contact customers for the ${kpi.dormant_sims} dormant SIMs to verify tracker status
2. **Within 48 hours:** Send field technicians to verify the ${kpi.offline_sims} offline SIMs
3. **This month:** Audit and deactivate SIMs dormant for 90+ days to reduce operational costs
4. **Estimated savings:** Deactivating dormant SIMs could save approximately $${(kpi.dormant_sims * 8.5).toFixed(0)}/month in subscription fees`,

    "executive-summary": `## Executive Summary — ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}

**Prepared for:** Board of Directors, Bantu Track Pvt Ltd
**Classification:** Confidential

---

### Fleet Performance Overview

The AFIS platform currently monitors **${kpi.total_vehicles} vehicles** across **${kpi.customers} customer accounts** in 8 SADC markets. Fleet utilization stands at **${utilizationPct}%**, with an overall device health score of **${kpi.device_health_pct}%**.

### Key Performance Indicators

| Metric | Value | Status |
|---|---|---|
| Total Fleet Size | ${kpi.total_vehicles} vehicles | ✓ |
| Active Vehicles | ${kpi.active_vehicles} | ✓ |
| Fleet Utilization | ${utilizationPct}% | ${utilizationPct > 60 ? "✓ On Target" : "⚠ Below Target"} |
| SIM Connectivity Rate | ${((kpi.active_sims / kpi.total_sims) * 100).toFixed(1)}% | ${kpi.active_sims / kpi.total_sims > 0.7 ? "✓" : "⚠"} |
| Device Health Score | ${kpi.device_health_pct}% | ${kpi.device_health_pct > 80 ? "✓" : "⚠"} |

### Strategic Risks

1. **Connectivity Gap:** ${offlinePct}% SIM offline rate creates monitoring blind spots. Recommend connectivity SLA review with network providers.
2. **Dormant Assets:** ${dormantPct}% dormant SIM rate indicates potential tracker failures or inactive customer vehicles.
3. **Device Health:** ${TRACKING_DEVICES.filter((d) => d.health === "critical").length} devices in critical health state — budget for replacement cycle.

### Revenue Intelligence

Active customer fleet generates an estimated **$${(kpi.active_customers * 1850).toLocaleString()}/month** in monitoring revenue. Dormant SIM cleanup could reduce costs by an estimated **$${(kpi.dormant_sims * 8.5 * 12).toLocaleString()}/year**.

### Board Recommendations

1. Approve Q3 device replacement budget for ${TRACKING_DEVICES.filter((d) => d.health !== "healthy").length} non-healthy units
2. Mandate SIM dormancy audit — target <10% dormancy rate by end of quarter
3. Expand fleet monitoring to cover projected 20% customer growth in ZA and ZW markets`,

    "risk-assessment": `## Fleet Risk Assessment Report

**Date:** ${new Date().toLocaleDateString("en-GB", { dateStyle: "full" })}
**Risk Engine:** AFIS XGBoost v2.3 | AFIS-FSI Compliant

---

### Risk Distribution

| Risk Level | Vehicles | % of Fleet |
|---|---|---|
| High Risk | ${VEHICLES.filter((v) => v.risk === "High").length} | ${((VEHICLES.filter((v) => v.risk === "High").length / kpi.total_vehicles) * 100).toFixed(1)}% |
| Medium Risk | ${VEHICLES.filter((v) => v.risk === "Medium").length} | ${((VEHICLES.filter((v) => v.risk === "Medium").length / kpi.total_vehicles) * 100).toFixed(1)}% |
| Low Risk | ${VEHICLES.filter((v) => v.risk === "Low").length} | ${((VEHICLES.filter((v) => v.risk === "Low").length / kpi.total_vehicles) * 100).toFixed(1)}% |

### Pre-Incident Warnings

${ALERTS.filter((a) => a.alert_type === "preincident" && !a.resolved).length} active Pre-Incident Warnings detected in the last 24 hours. These vehicles exhibit behaviour patterns statistically correlated with imminent incidents.

### Expected Loss Cost (ELC) Summary

Based on current risk scores and historical claims data:
- **Total fleet ELC:** $${(VEHICLES.reduce((s, v) => s + (v.risk === "High" ? 2800 : v.risk === "Medium" ? 1200 : 450), 0)).toLocaleString()}/year
- **High-risk reduction opportunity:** Targeted driver coaching for the ${VEHICLES.filter((v) => v.risk === "High").length} high-risk vehicles could reduce ELC by 35%

### Critical Alerts (Last 24h)

${ALERTS.filter((a) => a.severity === "critical" && !a.resolved).slice(0, 5).map((a) => `- **${a.vehicle}** — ${a.description}`).join("\n")}

### Recommendations

1. Immediate coaching intervention for all High Risk drivers
2. GPS geofence review for vehicles with repeated boundary breaches
3. Schedule maintenance inspections for vehicles with critical device health`,

    "fleet-efficiency": `## Fleet Efficiency Report

**Period:** Last 7 days | **Generated:** ${new Date().toLocaleString("en-GB")}

### Utilization Analysis

- **Active utilization:** ${utilizationPct}% (target: 70%)
- **Average daily distance:** ${randBetween(180, 320)} km/vehicle
- **Total fleet distance:** ${(VEHICLES.length * randBetween(180, 320)).toLocaleString()} km this week

### Fuel Efficiency

- **Average consumption:** ${(8.5 + Math.random()).toFixed(1)} L/100km
- **Idle time (fleet-wide):** ${(VEHICLES.filter((v) => v.status === "idling").length * 2.3).toFixed(1)} hours today
- **Estimated idle fuel waste:** $${(VEHICLES.filter((v) => v.status === "idling").length * 12.5).toFixed(0)}/day

### Top Performers
${VEHICLES.filter((v) => v.status === "moving").slice(0, 3).map((v) => `- **${v.registration}** (${v.driver}) — ${randBetween(85, 98)}% efficiency score`).join("\n")}

### Under-Performers Requiring Attention
${VEHICLES.filter((v) => v.status === "idling").slice(0, 3).map((v) => `- **${v.registration}** — excessive idle time detected`).join("\n")}

### Cost Optimisation Opportunities

1. Route optimisation for 12 vehicles on overlapping corridors — estimated saving: $${randBetween(800, 2400)}/month
2. Idle time reduction programme — estimated saving: $${(VEHICLES.filter((v) => v.status === "idling").length * 12.5 * 30).toFixed(0)}/month
3. Tyre pressure monitoring integration — estimated 3-5% fuel saving`,
  }

  return reports[reportId] ?? `## ${AI_REPORTS.find((r) => r.id === reportId)?.title ?? "AI Report"}

**Generated:** ${new Date().toLocaleString("en-GB")}

Analysis for this report type is being generated based on current fleet data...

**Fleet Summary**
- Total Vehicles: ${kpi.total_vehicles}
- Active SIMs: ${kpi.active_sims}/${kpi.total_sims}
- Fleet Utilization: ${utilizationPct}%
- Device Health: ${kpi.device_health_pct}%

*Full analysis available in the production AI engine with live Navixy/GPS data integration.*`
}
