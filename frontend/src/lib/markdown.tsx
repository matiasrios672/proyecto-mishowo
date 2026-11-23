import type { ReactNode } from "react";

// Markdown mínimo y seguro para blog, ayuda y legales. Todo el texto pasa por React (nunca HTML crudo)
// y los links solo pueden ser internos (/...) o https://.

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https:\/\/[^\s]+$/i.test(href)) return href;
  return null;
}

function inline(text: string, key: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = safeHref(link[2]!);
      if (!href) return link[1];
      const external = href.startsWith("https://");
      return <a key={k} href={href} className="font-medium  hover:text-primary" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link[1]}</a>;
    }
    return part;
  });
}

export function slugifyHeading(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, "").trim().split(/\n{2,}/);
  return (
    <div className="space-y-5 text-[1.05rem] leading-relaxed">
      {blocks.map((raw, i) => {
        const b = raw.trim();
        const k = `b${i}`;
        if (b === "---") return <hr key={k} className="border-border" />;
        const h = b.match(/^(#{1,3})\s+(.+)$/);
        if (h) {
          const text = h[2]!;
          if (h[1]!.length === 1) return <h2 key={k} id={slugifyHeading(text)} className="mk-display pt-4 text-3xl font-extrabold tracking-tight">{text}</h2>;
          if (h[1]!.length === 2) return <h3 key={k} id={slugifyHeading(text)} className="mk-display pt-3 text-2xl font-bold tracking-tight">{text}</h3>;
          return <h4 key={k} className="mk-display pt-2 text-xl font-bold">{text}</h4>;
        }
        const lines = b.split("\n");
        if (lines.every((l) => /^-\s+/.test(l)))
          return <ul key={k} className="list-disc space-y-2 pl-6 marker:text-primary">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^-\s+/, ""), `${k}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+\.\s+/.test(l)))
          return <ol key={k} className="list-decimal space-y-2 pl-6 marker:font-bold marker:text-primary">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\.\s+/, ""), `${k}-${j}`)}</li>)}</ol>;
        return <p key={k}>{inline(lines.join(" "), k)}</p>;
      })}
    </div>
  );
}
