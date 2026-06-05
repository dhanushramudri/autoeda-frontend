import {  ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSemanticTypeColor(type: string): string {
  const colors: Record<string, string> = {
    numeric: "#3b82f6",
    categorical: "#8b5cf6",
    datetime: "#10b981",
    boolean: "#f59e0b",
    text: "#6366f1",
    id_like: "#94a3b8",
    constant: "#ef4444",
  };
  return colors[type] ?? "#94a3b8";
}

export function getSemanticTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    numeric: "Numeric",
    categorical: "Categorical",
    datetime: "DateTime",
    boolean: "Boolean",
    text: "Long Text",
    id_like: "ID-like",
    constant: "Constant",
  };
  return labels[type] ?? type;
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    info: "text-brand bg-blue-50 border-blue-200",
    warning: "text-amber-600 bg-amber-50 border-amber-200",
    danger: "text-red-600 bg-red-50 border-red-200",
  };
  return colors[severity] ?? colors.info;
}

export function getSourceTypeIcon(sourceType: string): string {
  const icons: Record<string, string> = {
    file: "📁",
    postgresql: "🐘",
    mysql: "🐬",
    sqlite: "💾",
    mssql: "🪟",
    mongodb: "🍃",
    s3: "☁️",
    azure: "🔵",
    gcs: "🌐",
    rest_api: "🔌",
  };
  return icons[sourceType] ?? "📊";
}

export function getQualityScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
