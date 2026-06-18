import {
  TrendingDown, TrendingUp, DollarSign, Megaphone, Package, Users,
  ShieldAlert, MessageSquare, Image as ImageIcon, HeartPulse,
  Truck, Building2, GraduationCap, BookOpen, type LucideIcon,
} from "lucide-react";

const KEYWORD_ICONS: Array<[RegExp, LucideIcon]> = [
  [/churn|retention|attrition/i, TrendingDown],
  [/forecast|demand|time.?series|trend/i, TrendingUp],
  [/revenue|sales|finance|pricing|profit/i, DollarSign],
  [/marketing|campaign|advert/i, Megaphone],
  [/product|catalog|inventory|sku/i, Package],
  [/customer|user|crm|persona/i, Users],
  [/risk|fraud|credit|security/i, ShieldAlert],
  [/text|nlp|sentiment|review|feedback/i, MessageSquare],
  [/image|vision|cv|photo/i, ImageIcon],
  [/health|medical|patient|clinical/i, HeartPulse],
  [/logistics|supply|shipping|delivery/i, Truck],
  [/hr|employee|workforce|org/i, Building2],
  [/education|student|course|learning/i, GraduationCap],
];

export function iconForCategory(name: string): LucideIcon {
  for (const [re, Icon] of KEYWORD_ICONS) {
    if (re.test(name)) return Icon;
  }
  return BookOpen;
}

export const CATEGORY_PALETTE = [
  { solid: "#1D4ED8", soft: "#EFF6FF", ring: "#BFDBFE" },
  { solid: "#7C3AED", soft: "#F5F3FF", ring: "#DDD6FE" },
  { solid: "#059669", soft: "#ECFDF5", ring: "#A7F3D0" },
  { solid: "#D97706", soft: "#FFFBEB", ring: "#FDE68A" },
  { solid: "#DC2626", soft: "#FEF2F2", ring: "#FECACA" },
  { solid: "#0891B2", soft: "#ECFEFF", ring: "#A5F3FC" },
  { solid: "#DB2777", soft: "#FDF2F8", ring: "#FBCFE8" },
  { solid: "#0284C7", soft: "#F0F9FF", ring: "#BAE6FD" },
];

export function colorForCategory(index: number) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
