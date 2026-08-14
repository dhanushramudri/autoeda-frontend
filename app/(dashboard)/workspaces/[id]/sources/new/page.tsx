"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sourcesApi } from "@/lib/api";
import {
  ArrowLeft, Database, Cloud, Globe, FileText,
  CheckCircle2, XCircle, Loader2, Plug, Lock,
  Search, ChevronRight, Shield, Zap, Check,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ConnectorLogo } from "@/components/shared/ConnectorLogo";

// -- Types ----------------------------------------------------------------------

interface CatalogEntry { id: string; label: string; group: string; icon: string }

type Step = "pick_type" | "configure" | "test" | "save";

const STEPS: { key: Step; label: string; desc: string }[] = [
  { key: "pick_type",  label: "Choose Connector", desc: "Select a data source type" },
  { key: "configure",  label: "Configure",         desc: "Enter connection details" },
  { key: "test",       label: "Test Connection",   desc: "Verify connectivity" },
  { key: "save",       label: "Review & Save",     desc: "Confirm and save" },
];

const STEP_IDX: Record<Step, number> = { pick_type: 0, configure: 1, test: 2, save: 3 };

const GROUP_ORDER = ["Data Platforms", "Databases", "Cloud Storage", "Files", "APIs"];

const GROUP_META: Record<string, { icon: React.ComponentType<{className?:string}>; color: string; bg: string }> = {
  "Data Platforms":{ icon: Zap,      color: "text-orange-600", bg: "bg-orange-50" },
  Databases:      { icon: Database,  color: "text-violet-600", bg: "bg-violet-50" },
  "Cloud Storage":{ icon: Cloud,     color: "text-sky-600",    bg: "bg-sky-50" },
  APIs:           { icon: Globe,     color: "text-emerald-600",bg: "bg-emerald-50" },
  Files:          { icon: FileText,  color: "text-amber-600",  bg: "bg-amber-50" },
};

// -- Field definitions ----------------------------------------------------------

type FieldDef = {
  key: string; label: string;
  type?: "text" | "password" | "number" | "textarea";
  placeholder?: string; required?: boolean; isCredential?: boolean;
};

const SOURCE_FIELDS: Record<string, FieldDef[]> = {
  postgresql: [
    { key: "host",     label: "Host",     placeholder: "localhost",  required: true },
    { key: "port",     label: "Port",     type: "number", placeholder: "5432" },
    { key: "database", label: "Database", placeholder: "mydb",       required: true },
    { key: "username", label: "Username", isCredential: true, required: true },
    { key: "password", label: "Password", type: "password", isCredential: true, required: true },
  ],
  mysql: [
    { key: "host",     label: "Host",     placeholder: "localhost", required: true },
    { key: "port",     label: "Port",     type: "number", placeholder: "3306" },
    { key: "database", label: "Database", placeholder: "mydb",      required: true },
    { key: "username", label: "Username", isCredential: true, required: true },
    { key: "password", label: "Password", type: "password", isCredential: true, required: true },
  ],
  mssql: [
    { key: "host",     label: "Host",     placeholder: "localhost", required: true },
    { key: "port",     label: "Port",     type: "number", placeholder: "1433" },
    { key: "database", label: "Database", placeholder: "mydb",      required: true },
    { key: "username", label: "Username", isCredential: true, required: true },
    { key: "password", label: "Password", type: "password", isCredential: true, required: true },
  ],
  sqlite: [
    { key: "database", label: "File Path", placeholder: "/path/to/db.sqlite", required: true },
  ],
  redshift: [
    { key: "host",     label: "Host",     required: true },
    { key: "port",     label: "Port",     type: "number", placeholder: "5439" },
    { key: "database", label: "Database", required: true },
    { key: "username", label: "Username", isCredential: true, required: true },
    { key: "password", label: "Password", type: "password", isCredential: true, required: true },
  ],
  snowflake: [
    { key: "account",   label: "Account",   placeholder: "xyz.us-east-1", required: true },
    { key: "database",  label: "Database",  required: true },
    { key: "username",  label: "Username",  isCredential: true, required: true },
    { key: "password",  label: "Password",  type: "password", isCredential: true, required: true },
    { key: "warehouse", label: "Warehouse", placeholder: "COMPUTE_WH" },
    { key: "schema",    label: "Schema",    placeholder: "PUBLIC" },
  ],
  bigquery: [
    { key: "project_id",           label: "Project ID",           required: true },
    { key: "dataset",              label: "Dataset",              required: true },
    { key: "service_account_json", label: "Service Account JSON", type: "textarea", isCredential: true, required: true },
  ],
  mongodb: [
    { key: "uri",        label: "Connection URI", placeholder: "mongodb://...", isCredential: true, required: true },
    { key: "database",   label: "Database",   required: true },
    { key: "collection", label: "Collection", required: true },
  ],
  s3: [
    { key: "bucket",               label: "Bucket",          required: true },
    { key: "key",                  label: "Object Key",      placeholder: "data/file.csv", required: true },
    { key: "region",               label: "Region",          placeholder: "us-east-1" },
    { key: "aws_access_key_id",    label: "Access Key ID",   isCredential: true, required: true },
    { key: "aws_secret_access_key",label: "Secret Access Key",type: "password", isCredential: true, required: true },
  ],
  azure_blob: [
    { key: "container",         label: "Container",         required: true },
    { key: "blob_name",         label: "Blob Name",         required: true },
    { key: "connection_string", label: "Connection String", type: "password", isCredential: true, required: true },
  ],
  gcs: [
    { key: "bucket",               label: "Bucket",               required: true },
    { key: "blob_name",            label: "Object Name",          required: true },
    { key: "service_account_json", label: "Service Account JSON", type: "textarea", isCredential: true, required: true },
  ],
  google_drive: [
    { key: "file_id",              label: "File ID",              required: true },
    { key: "service_account_json", label: "Service Account JSON", type: "textarea", isCredential: true, required: true },
  ],
  csv:     [
    { key: "file_path", label: "File Path",  placeholder: "/path/to/file.csv", required: true },
    { key: "delimiter", label: "Delimiter",  placeholder: "," },
  ],
  excel:   [
    { key: "file_path",  label: "File Path",   placeholder: "/path/to/file.xlsx", required: true },
    { key: "sheet_name", label: "Sheet Name",  placeholder: "Sheet1" },
  ],
  json:    [{ key: "file_path", label: "File Path", placeholder: "/path/to/data.json",    required: true }],
  parquet: [{ key: "file_path", label: "File Path", placeholder: "/path/to/data.parquet", required: true }],
  rest_api: [
    { key: "url",       label: "URL",       placeholder: "https://api.example.com/data", required: true },
    { key: "method",    label: "Method",    placeholder: "GET" },
    { key: "json_path", label: "JSON Path", placeholder: "data.results" },
    { key: "auth_type", label: "Auth Type", placeholder: "bearer / api_key / basic / none" },
    { key: "token",     label: "Token / API Key",       type: "password", isCredential: true },
    { key: "username",  label: "Basic Auth Username",   isCredential: true },
    { key: "password",  label: "Basic Auth Password",   type: "password", isCredential: true },
  ],
  graphql: [
    { key: "url",   label: "GraphQL Endpoint", required: true },
    { key: "query", label: "GraphQL Query",    type: "textarea", required: true },
    { key: "token", label: "Auth Token",       type: "password", isCredential: true },
  ],
  databricks: [
    { key: "server_hostname", label: "Server Hostname", placeholder: "<instance>.azuredatabricks.net", required: true },
    { key: "http_path",       label: "HTTP Path",       placeholder: "/sql/1.0/warehouses/<id>",       required: true },
    { key: "access_token",    label: "Access Token",    type: "password", isCredential: true, required: true },
    { key: "catalog",         label: "Catalog",         placeholder: "hive_metastore (optional)" },
    { key: "schema",          label: "Schema",          placeholder: "default (optional)" },
  ],
  fabric: [
    { key: "server",   label: "Server",   placeholder: "<workspace>.datawarehouse.fabric.microsoft.com", required: true },
    { key: "database", label: "Database", placeholder: "Warehouse or Lakehouse name",                    required: true },
    { key: "username", label: "Username", placeholder: "user@org.com or service-principal client ID",    isCredential: true, required: true },
    { key: "password", label: "Password", type: "password", isCredential: true, required: true },
  ],
};

// -- Vertical stepper ----------------------------------------------------------

function StepNav({ current }: { current: Step }) {
  const currentIdx = STEP_IDX[current];
  return (
    <div className="flex flex-col gap-1 w-56 flex-shrink-0">
      {STEPS.map((s, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={s.key} className="flex gap-3 items-start">
            {/* connector line + circle */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                done    && "bg-brand text-white",
                active  && "bg-brand text-white ring-4 ring-brand/20",
                pending && "bg-muted text-muted-foreground border border-border",
              )}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-0.5 h-8 mt-1 rounded-full transition-all", done ? "bg-brand" : "bg-muted")} />
              )}
            </div>
            {/* labels */}
            <div className="pb-8">
              <p className={cn("text-sm font-semibold leading-none", active ? "text-foreground" : done ? "text-brand" : "text-muted-foreground")}>
                {s.label}
              </p>
              <p className={cn("text-[11px] mt-0.5", active ? "text-muted-foreground" : "text-muted-foreground/60")}>
                {s.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Input field ---------------------------------------------------------------

function Field({ fd, value, onChange }: {
  fd: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition placeholder:text-muted-foreground/60";
  const cls  = cn(base, fd.isCredential ? "border-amber-200 bg-amber-50/30" : "border-border bg-card");

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-medium text-foreground">
          {fd.label}
          {fd.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {fd.isCredential && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
            <Lock className="w-2.5 h-2.5" /> encrypted
          </span>
        )}
      </div>
      {fd.type === "textarea" ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fd.placeholder}
          className={cn(cls, "font-mono resize-none text-xs")}
        />
      ) : (
        <input
          type={fd.type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fd.placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// -- Page ----------------------------------------------------------------------

export default function NewSourcePage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep]               = useState<Step>("pick_type");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields]           = useState<Record<string, string>>({});
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [search, setSearch]           = useState("");

  const { data: catalogData } = useQuery({
    queryKey: ["sources-catalog"],
    queryFn: () => sourcesApi.catalog().then((r) => r.data),
  });

  const catalog: CatalogEntry[] = catalogData?.catalog ?? [];
  const groups = GROUP_ORDER.filter((g) => catalog.some((c) => c.group === g));

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog;
    return catalog.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
  }, [catalog, search]);

  const testMut = useMutation({
    mutationFn: () => {
      const fieldDefs = SOURCE_FIELDS[selectedType!] ?? [];
      const credentials: Record<string, unknown> = {};
      const config: Record<string, unknown> = {};
      for (const fd of fieldDefs) {
        const val = fields[fd.key];
        if (!val) continue;
        if (fd.isCredential) credentials[fd.key] = val;
        else config[fd.key] = fd.type === "number" ? Number(val) : val;
      }
      return sourcesApi.testAdhoc({ source_type: selectedType!, credentials, config });
    },
    onSuccess: (res) => setTestResult(res.data),
    onError: () => setTestResult({ ok: false, message: "Request failed" }),
  });

  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: () => {
      const fieldDefs = SOURCE_FIELDS[selectedType!] ?? [];
      const credentials: Record<string, unknown> = {};
      const config: Record<string, unknown> = {};
      for (const fd of fieldDefs) {
        const val = fields[fd.key];
        if (!val) continue;
        if (fd.isCredential) credentials[fd.key] = val;
        else config[fd.key] = fd.type === "number" ? Number(val) : val;
      }
      return sourcesApi.create(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        source_type: selectedType!,
        credentials,
        config,
      });
    },
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ["sources", workspaceId] });
      router.push(`/workspaces/${workspaceId}/sources`);
    },
  });

  const fieldDefs      = selectedType ? (SOURCE_FIELDS[selectedType] ?? []) : [];
  const selectedEntry  = catalog.find((c) => c.id === selectedType);
  const selectedMeta   = selectedEntry ? GROUP_META[selectedEntry.group] : null;

  // -- Render ------------------------------------------------------------------

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-muted/60">

      {/* -- Top bar -- */}
      <div className="flex items-center gap-4 px-6 py-3.5 bg-card border-b border-border flex-shrink-0">
        <Link
          href={`/workspaces/${workspaceId}/sources`}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="h-5 w-px bg-muted" />
        <div>
          <h1 className="text-sm font-bold text-foreground">Add Data Source</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
            Connect to a database, cloud storage, file, or API
          </p>
        </div>
        {selectedEntry && (
          <div className={cn("ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold", selectedMeta?.bg, selectedMeta?.color)}>
            {selectedEntry.label}
          </div>
        )}
      </div>

      {/* -- Body -- */}
      <div className="flex-1 flex gap-0">

        {/* -- Left: step nav -- */}
        <div className="w-64 flex-shrink-0 border-r border-border bg-card px-6 py-8 hidden lg:flex">
          <StepNav current={step} />
        </div>

        {/* -- Right: content -- */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">

          {/* ══ Step 1: Pick type ══════════════════════════════════════════ */}
          {step === "pick_type" && (
            <div className="max-w-3xl">
              <h2 className="text-lg font-bold text-foreground mb-1">Choose a connector</h2>
              <p className="text-sm text-muted-foreground mb-6">Select the type of data source you want to connect.</p>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search connectors..."
                  className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
                />
              </div>

              {/* Grid  --  filtered */}
              {search.trim() ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filtered.map((entry) => (
                    <ConnectorCard key={entry.id} entry={entry}
                      onClick={() => { setSelectedType(entry.id); setStep("configure"); }} />
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-4 text-sm text-muted-foreground py-8 text-center">No connectors match "{search}"</p>
                  )}
                </div>
              ) : (
                groups.map((group) => {
                  const meta    = GROUP_META[group] ?? { icon: Plug, color: "text-muted-foreground", bg: "bg-muted" };
                  const Icon    = meta.icon;
                  const entries = catalog.filter((c) => c.group === group);
                  return (
                    <div key={group} className="mb-8">
                      <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4", meta.bg, meta.color)}>
                        <Icon className="w-3.5 h-3.5" />
                        {group}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {entries.map((entry) => (
                          <ConnectorCard key={entry.id} entry={entry}
                            onClick={() => { setSelectedType(entry.id); setStep("configure"); }} />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══ Step 2: Configure ══════════════════════════════════════════ */}
          {step === "configure" && selectedType && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-bold text-foreground mb-1">Configure connection</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enter the details for your <span className="font-semibold text-foreground">{selectedEntry?.label}</span> connection.
              </p>

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* General info */}
                <div className="px-6 py-5 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">General</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        Source Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Production PostgreSQL"
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-foreground mb-1.5 block">Description</label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional  --  describe what this source contains"
                        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                </div>

                {/* Connection fields */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connection Details</p>
                    {fieldDefs.some((f) => f.isCredential) && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full font-medium">
                        <Shield className="w-3 h-3" /> Credentials are stored encrypted
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fieldDefs.map((fd) => (
                      <div key={fd.key} className={fd.type === "textarea" ? "sm:col-span-2" : ""}>
                        <Field
                          fd={fd}
                          value={fields[fd.key] ?? ""}
                          onChange={(v) => setFields((p) => ({ ...p, [fd.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setStep("pick_type")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    onClick={() => setStep("test")}
                    disabled={!name.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-[#2a0d8a] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                  >
                    Next: Test Connection <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ Step 3: Test ═══════════════════════════════════════════════ */}
          {step === "test" && (
            <div className="max-w-lg">
              <h2 className="text-lg font-bold text-foreground mb-1">Test connection</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Verify AutoEDA can reach <span className="font-semibold text-foreground">{name}</span> before saving.
              </p>

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-8">
                  {/* Idle */}
                  {!testResult && !testMut.isPending && (
                    <div className="flex flex-col items-center gap-5 py-4">
                      <div className="w-20 h-20 rounded-2xl bg-brand/8 border border-brand/20 flex items-center justify-center">
                        <Plug className="w-9 h-9 text-brand/60" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground mb-1">Ready to test</p>
                        <p className="text-xs text-muted-foreground">We'll attempt to connect using the credentials you provided.</p>
                      </div>
                      <button
                        onClick={() => testMut.mutate()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-[#2a0d8a] transition shadow-sm"
                      >
                        <Zap className="w-4 h-4" /> Run Test
                      </button>
                    </div>
                  )}

                  {/* Loading */}
                  {testMut.isPending && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-brand/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">Connecting...</p>
                        <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {testResult && (
                    <div className={cn(
                      "rounded-xl p-5 border",
                      testResult.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                    )}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          testResult.ok ? "bg-emerald-100" : "bg-red-100")}>
                          {testResult.ok
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            : <XCircle className="w-5 h-5 text-red-500" />}
                        </div>
                        <div>
                          <p className={cn("font-semibold text-sm", testResult.ok ? "text-emerald-800" : "text-red-800")}>
                            {testResult.ok ? "Connection successful" : "Connection failed"}
                          </p>
                          <p className={cn("text-xs font-mono mt-0.5", testResult.ok ? "text-emerald-600" : "text-red-600")}>
                            {testResult.message}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setTestResult(null); testMut.reset(); }}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition"
                      >
                        Test again
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setStep("configure")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    onClick={() => setStep("save")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-[#2a0d8a] transition shadow-sm"
                  >
                    {testResult?.ok ? "Next: Review" : "Skip & Review"} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ Step 4: Save ═══════════════════════════════════════════════ */}
          {step === "save" && (
            <div className="max-w-lg">
              <h2 className="text-lg font-bold text-foreground mb-1">Review & save</h2>
              <p className="text-sm text-muted-foreground mb-6">Confirm the details below and save your data source.</p>

              <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
                {/* Source header */}
                <div className={cn("flex items-center gap-4 px-6 py-5 border-b border-border bg-muted")}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-card shadow-sm border border-border flex-shrink-0">
                    <ConnectorLogo id={selectedType ?? ""} className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{name}</p>
                    <p className={cn("text-xs font-medium", selectedMeta?.color)}>{selectedEntry?.label}</p>
                  </div>
                  {testResult?.ok && (
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="px-6 py-5 space-y-3">
                  {description && (
                    <ReviewRow label="Description" value={description} />
                  )}
                  <ReviewRow label="Connection test" value={
                    testResult
                      ? testResult.ok ? "Passed ok" : "Failed"
                      : "Not tested"
                  } highlight={testResult?.ok ? "green" : testResult ? "red" : undefined} />
                  <ReviewRow label="Credentials" value="Stored encrypted" icon={<Lock className="w-3 h-3 text-amber-500" />} />
                </div>

                {saveMut.isError && (
                  <div className="mx-6 mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    Failed to save. Please try again.
                  </div>
                )}

                <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setStep("test")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-[#2a0d8a] disabled:opacity-50 transition shadow-sm"
                  >
                    {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Data Source
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// -- Sub-components ------------------------------------------------------------

function ConnectorCard({ entry, onClick }: {
  entry: CatalogEntry;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:border-brand/40 hover:shadow-md transition-all text-center"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 bg-card border border-border shadow-sm">
        <ConnectorLogo id={entry.id} className="w-8 h-8" />
      </div>
      <span className="text-xs font-semibold text-foreground leading-snug group-hover:text-brand transition-colors">
        {entry.label}
      </span>
    </button>
  );
}

function ReviewRow({ label, value, highlight, icon }: {
  label: string; value: string;
  highlight?: "green" | "red";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn(
        "font-medium text-xs flex items-center gap-1",
        highlight === "green" ? "text-emerald-600"
          : highlight === "red" ? "text-red-500"
          : "text-foreground"
      )}>
        {icon}
        {value}
      </span>
    </div>
  );
}
