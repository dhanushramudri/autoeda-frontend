"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// react-markdown's default URL sanitizer strips "data:" URIs (to block
// javascript:/other unsafe schemes) — that also silently breaks legitimate
// embedded chart images (data:image/png;base64,...), e.g. from Auto EDA
// reports. Allow only the image subset through; defer everything else to
// the library's own default allowlist (http/https/mailto/relative/etc).
function allowInlineImages(url: string): string {
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(url)) return url;
  return defaultUrlTransform(url);
}

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn("ai-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={allowInlineImages}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="max-w-full rounded-lg border border-border" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
