"use client";

interface LogoProps { className?: string }

// ── PostgreSQL ─────────────────────────────────────────────────────────────
function PostgreSQLLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* body */}
      <ellipse cx="11.5" cy="11.5" rx="7" ry="7.5" fill="#336791" />
      {/* ear */}
      <ellipse cx="17" cy="7.5" rx="2.2" ry="3.2" fill="#336791" />
      {/* inner face shading */}
      <ellipse cx="11.5" cy="11.5" rx="5.2" ry="5.8" fill="#4a7fa5" opacity="0.5" />
      {/* eyes */}
      <circle cx="9.5" cy="9.5" r="0.9" fill="white" />
      <circle cx="13" cy="9.5" r="0.9" fill="white" />
      {/* trunk */}
      <path d="M7 16 Q4.5 17.5 4.5 20 Q4.5 22 7 22.5" stroke="#336791" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* tusk */}
      <path d="M9 16 Q7.5 17.5 7.5 19.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── MySQL ──────────────────────────────────────────────────────────────────
function MySQLLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* dolphin body arc */}
      <path d="M4 14.5 Q8 5.5 16 7.5 Q20.5 9 21.5 13" stroke="#00618A" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* dorsal fin */}
      <path d="M14 6.5 L16 3.5 L18 6.5" fill="#00618A" />
      {/* tail */}
      <path d="M4 14.5 L2 12.5 M4 14.5 L2 17" stroke="#00618A" strokeWidth="2" strokeLinecap="round" />
      {/* belly */}
      <path d="M5.5 13.5 Q10 8.5 17 9.5" stroke="#E48E00" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.9" />
      {/* eye */}
      <circle cx="19.5" cy="11" r="0.9" fill="#00618A" />
    </svg>
  );
}

// ── SQL Server ─────────────────────────────────────────────────────────────
function SQLServerLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <ellipse cx="12" cy="5.5" rx="8.5" ry="2.5" fill="#CC2927" />
      <rect x="3.5" y="5.5" width="17" height="5.5" fill="#CC2927" />
      <ellipse cx="12" cy="11" rx="8.5" ry="2.5" fill="#A82321" />
      <rect x="3.5" y="11" width="17" height="5.5" fill="#A82321" />
      <ellipse cx="12" cy="16.5" rx="8.5" ry="2.5" fill="#861817" />
      {/* highlight arc on top */}
      <path d="M5 4.5 Q12 2.5 19 4.5" stroke="#e83f3c" strokeWidth="0.8" fill="none" opacity="0.7" />
      {/* S shape on middle band */}
      <path d="M9 9 Q12 8.5 12 10 Q12 11.5 15 11" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

// ── SQLite ─────────────────────────────────────────────────────────────────
function SQLiteLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* cloud/database shape */}
      <path d="M18.5 10.5 A4.5 4.5 0 0 0 11 7 A3.5 3.5 0 0 0 6 10.5 A4 4 0 0 0 7.5 18 L18 18 A4.5 4.5 0 0 0 18.5 10.5Z" fill="#003B57" />
      {/* highlight */}
      <path d="M9 10 Q10 8 13.5 8.5" stroke="#0F80CC" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* SQ letters simplified as two bars */}
      <rect x="8" y="12" width="2" height="3.5" rx="0.5" fill="white" opacity="0.6" />
      <rect x="11.5" y="12" width="2" height="3.5" rx="0.5" fill="white" opacity="0.6" />
      <rect x="15" y="12" width="1.5" height="3.5" rx="0.5" fill="white" opacity="0.6" />
    </svg>
  );
}

// ── Redshift ───────────────────────────────────────────────────────────────
function RedshiftLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="5" r="3" fill="#DD344C" />
      <circle cx="5" cy="17" r="3" fill="#DD344C" />
      <circle cx="19" cy="17" r="3" fill="#DD344C" />
      <line x1="12" y1="8" x2="6.8" y2="14.5" stroke="#FF9900" strokeWidth="1.8" />
      <line x1="12" y1="8" x2="17.2" y2="14.5" stroke="#FF9900" strokeWidth="1.8" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="#FF9900" strokeWidth="1.8" />
    </svg>
  );
}

// ── Snowflake ──────────────────────────────────────────────────────────────
function SnowflakeLogo({ className }: LogoProps) {
  const cx = 12, cy = 12;
  const arms = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60) - 90) * (Math.PI / 180);
    const cos = Math.cos(a), sin = Math.sin(a);
    const tx = cx + 9 * cos, ty = cy + 9 * sin;
    const mx = cx + 5 * cos, my = cy + 5 * sin;
    const bx = -sin * 2.5, by = cos * 2.5;
    return { tx, ty, mx, my, bx, by };
  });
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {arms.map(({ tx, ty, mx, my, bx, by }, i) => (
        <g key={i} stroke="#29B5E8" strokeLinecap="round">
          <line x1={cx} y1={cy} x2={tx} y2={ty} strokeWidth="1.8" />
          <line x1={mx - bx} y1={my - by} x2={mx + bx} y2={my + by} strokeWidth="1.8" />
        </g>
      ))}
      <circle cx={cx} cy={cy} r="1.8" fill="#29B5E8" />
    </svg>
  );
}

// ── BigQuery ───────────────────────────────────────────────────────────────
function BigQueryLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* coloured bar chart */}
      <rect x="2" y="14" width="4" height="7" rx="0.8" fill="#4285F4" />
      <rect x="7" y="10" width="4" height="11" rx="0.8" fill="#EA4335" />
      <rect x="12" y="6.5" width="4" height="14.5" rx="0.8" fill="#FBBC05" />
      {/* magnifying glass */}
      <circle cx="18" cy="8" r="3.8" stroke="#34A853" strokeWidth="2" fill="none" />
      <line x1="20.7" y1="10.7" x2="23" y2="13" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── MongoDB ────────────────────────────────────────────────────────────────
function MongoDBLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2C10.5 4.5 8 8.5 8 12.5C8 16.3 10 19.5 12 21.5C14 19.5 16 16.3 16 12.5C16 8.5 13.5 4.5 12 2Z" fill="#00ED64" />
      <line x1="12" y1="21.5" x2="12" y2="24" stroke="#00684A" strokeWidth="2" strokeLinecap="round" />
      {/* mid-vein */}
      <path d="M12 3C11.5 7 11.3 11 11.5 15" stroke="#00684A" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// ── Amazon S3 ──────────────────────────────────────────────────────────────
function S3Logo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* bucket body */}
      <path d="M4 7.5 L12 4 L20 7.5 L20 19 L12 22.5 L4 19 Z" fill="#FF9900" />
      {/* top face edge */}
      <path d="M4 7.5 L12 11 L20 7.5" stroke="#C47500" strokeWidth="1" fill="none" />
      {/* mid seam */}
      <path d="M12 11 L12 22.5" stroke="#C47500" strokeWidth="1" />
      {/* left face shade */}
      <path d="M4 7.5 L12 11 L12 22.5 L4 19 Z" fill="#C47500" opacity="0.35" />
    </svg>
  );
}

// ── Azure Blob ─────────────────────────────────────────────────────────────
function AzureBlobLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M3 17.5 Q7 13.5 12 15.5 Q17 17.5 21 13.5" stroke="#0078D4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M3 12.5 Q7 8.5 12 10.5 Q17 12.5 21 8.5" stroke="#50E6FF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M3 7.5 Q7 3.5 12 5.5 Q17 7.5 21 3.5" stroke="#0078D4" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// ── Google Cloud Storage ───────────────────────────────────────────────────
function GCSLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* hexagon outline */}
      <path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" stroke="#4285F4" strokeWidth="1" fill="#4285F4" fillOpacity="0.08" />
      {/* Google-colour edges */}
      <path d="M4 7.5 L12 12 L20 7.5" stroke="#4285F4" strokeWidth="2" fill="none" />
      <path d="M12 12 L12 21" stroke="#34A853" strokeWidth="2" />
      <path d="M4 7.5 L4 16.5 L12 21" stroke="#EA4335" strokeWidth="2" />
      <path d="M20 7.5 L20 16.5 L12 21" stroke="#FBBC05" strokeWidth="2" />
    </svg>
  );
}

// ── Google Drive ───────────────────────────────────────────────────────────
function GoogleDriveLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* three coloured panels of the Drive triangle */}
      <path d="M12 3 L7 12 L17 12 Z" fill="#4285F4" />
      <path d="M7 12 L2 21 L12 21 Z" fill="#34A853" />
      <path d="M17 12 L22 21 L12 21 Z" fill="#FBBC05" />
      {/* inner dividers */}
      <line x1="12" y1="3" x2="7" y2="12" stroke="white" strokeWidth="0.6" opacity="0.4" />
      <line x1="12" y1="3" x2="17" y2="12" stroke="white" strokeWidth="0.6" opacity="0.4" />
    </svg>
  );
}

// ── Databricks ─────────────────────────────────────────────────────────────
function DatabricksLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* 3-panel angular prism — top, right, left */}
      <path d="M12 3.5 L21 9 L12 12.5 L3 9 Z" fill="#FF3621" />
      <path d="M21 9 L21 15.5 L12 19 L12 12.5 Z" fill="#FF6435" />
      <path d="M3 9 L3 15.5 L12 19 L12 12.5 Z" fill="#C42B15" />
    </svg>
  );
}

// ── Microsoft Fabric ───────────────────────────────────────────────────────
function MicrosoftFabricLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="#742774" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" fill="#0F6CBD" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" fill="#00A693" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" fill="#E03B80" />
    </svg>
  );
}

// ── CSV / TSV ──────────────────────────────────────────────────────────────
function CSVLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#217346" />
      {/* header row */}
      <rect x="3" y="3" width="18" height="5.5" rx="2.5" fill="#1a5e38" />
      {/* grid lines */}
      <line x1="3" y1="8.5" x2="21" y2="8.5" stroke="white" strokeWidth="0.6" opacity="0.4" />
      <line x1="3" y1="13.5" x2="21" y2="13.5" stroke="white" strokeWidth="0.6" opacity="0.4" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="0.6" opacity="0.3" />
      <line x1="15" y1="3" x2="15" y2="21" stroke="white" strokeWidth="0.6" opacity="0.3" />
      {/* data cell dots */}
      <rect x="5" y="10.5" width="2.5" height="1.5" rx="0.3" fill="white" opacity="0.5" />
      <rect x="11" y="10.5" width="2.5" height="1.5" rx="0.3" fill="white" opacity="0.5" />
      <rect x="17" y="10.5" width="2.5" height="1.5" rx="0.3" fill="white" opacity="0.5" />
    </svg>
  );
}

// ── Excel ──────────────────────────────────────────────────────────────────
function ExcelLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#217346" />
      {/* X mark */}
      <path d="M7.5 8 L12 12.5 M12 12.5 L16.5 17 M16.5 8 L12 12.5 M12 12.5 L7.5 17" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

// ── JSON ───────────────────────────────────────────────────────────────────
function JSONLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#F7DF1E" />
      {/* { brace left */}
      <path d="M8 7 Q6 7 6 9 L6 11 Q6 12 4.5 12 Q6 12 6 13 L6 15 Q6 17 8 17" stroke="#323330" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* } brace right */}
      <path d="M16 7 Q18 7 18 9 L18 11 Q18 12 19.5 12 Q18 12 18 13 L18 15 Q18 17 16 17" stroke="#323330" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Parquet ────────────────────────────────────────────────────────────────
function ParquetLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* descending columns = columnar format */}
      <rect x="2.5" y="14" width="4.5" height="7.5" rx="1" fill="#E25A1C" />
      <rect x="9" y="9" width="4.5" height="12.5" rx="1" fill="#E25A1C" opacity="0.75" />
      <rect x="15.5" y="4" width="4.5" height="17.5" rx="1" fill="#E25A1C" opacity="0.5" />
      {/* connecting line across tops */}
      <path d="M4.75 14 L11.25 9 L17.75 4" stroke="#E25A1C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── REST API ───────────────────────────────────────────────────────────────
function RESTAPILogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="#6E56CF" strokeWidth="1.8" fill="none" />
      <ellipse cx="12" cy="12" rx="4.5" ry="9.5" stroke="#6E56CF" strokeWidth="1.2" fill="none" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="#6E56CF" strokeWidth="1.2" />
      <path d="M5 7 Q12 9 19 7 M5 17 Q12 15 19 17" stroke="#6E56CF" strokeWidth="0.9" fill="none" />
    </svg>
  );
}

// ── GraphQL ────────────────────────────────────────────────────────────────
function GraphQLLogo({ className }: LogoProps) {
  const c = 12, r = 8.5, dr = 1.5;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  });
  const hex = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d={hex} stroke="#E10098" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="#E10098" strokeWidth="1" opacity="0.5" />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={dr} fill="#E10098" />
      ))}
      <circle cx={c} cy={c} r={dr} fill="#E10098" />
    </svg>
  );
}

// ── Default fallback ───────────────────────────────────────────────────────
function DefaultLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#6B7280" />
      <circle cx="12" cy="12" r="4" fill="white" opacity="0.5" />
    </svg>
  );
}

// ── Map ────────────────────────────────────────────────────────────────────

const LOGO_MAP: Record<string, (p: LogoProps) => JSX.Element> = {
  postgresql:   PostgreSQLLogo,
  mysql:        MySQLLogo,
  mssql:        SQLServerLogo,
  sqlite:       SQLiteLogo,
  redshift:     RedshiftLogo,
  snowflake:    SnowflakeLogo,
  bigquery:     BigQueryLogo,
  mongodb:      MongoDBLogo,
  s3:           S3Logo,
  azure_blob:   AzureBlobLogo,
  gcs:          GCSLogo,
  google_drive: GoogleDriveLogo,
  databricks:   DatabricksLogo,
  fabric:       MicrosoftFabricLogo,
  csv:          CSVLogo,
  excel:        ExcelLogo,
  json:         JSONLogo,
  parquet:      ParquetLogo,
  rest_api:     RESTAPILogo,
  graphql:      GraphQLLogo,
};

export function ConnectorLogo({ id, className = "w-8 h-8" }: { id: string; className?: string }) {
  const Logo = LOGO_MAP[id] ?? DefaultLogo;
  return <Logo className={className} />;
}
