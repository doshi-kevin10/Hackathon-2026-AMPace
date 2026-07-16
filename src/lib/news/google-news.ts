import { XMLParser } from "fast-xml-parser";

export interface NewsItem {
  title: string;
  link: string;
  /** ISO 8601. */
  publishedAt: string;
  source: string | null;
  /** Short excerpt from the RSS description, if any text survives after stripping HTML. */
  snippet: string | null;
  /** Best-effort — Google News RSS rarely embeds one; null is the common case. */
  imageUrl: string | null;
}

const parser = new XMLParser({ ignoreAttributes: false });

/** Google News wraps titles as "Headline - Source"; split that back out. */
const splitTitleSource = (raw: string): { title: string; source: string | null } => {
  const i = raw.lastIndexOf(" - ");
  return i < 0 ? { title: raw, source: null } : { title: raw.slice(0, i), source: raw.slice(i + 3) };
};

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/** Strip tags from the RSS description and decode the handful of entities Google News actually uses. */
const extractSnippet = (html: string, excludeTitle: string): string | null => {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|quot|#39|apos|lt|gt);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  // The description is often just the title repeated as a link — not a real excerpt.
  if (!text || text === excludeTitle) return null;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};

const extractImage = (html: string): string | null => {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
};

const toArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { items: NewsItem[]; fetchedAt: number }>();

/**
 * Recent headlines for a company from Google News' keyless RSS search feed.
 * No API key required; best-effort — returns [] on any fetch/parse failure
 * rather than surfacing an error, since news is supplementary, not core data.
 * Cached briefly per company so frequent polling doesn't refetch every tick.
 */
export async function fetchCompanyNews(company: string, limit = 8): Promise<NewsItem[]> {
  const cached = cache.get(company);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(company)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ExcelTableStudio/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = toArray<Record<string, unknown>>(parsed?.rss?.channel?.item);
    const newsItems = items.slice(0, limit).map((item) => {
      const { title, source } = splitTitleSource(String(item.title ?? ""));
      const pubDate = item.pubDate ? new Date(String(item.pubDate)) : null;
      const descriptionHtml = String(item.description ?? "");
      return {
        title,
        link: String(item.link ?? ""),
        publishedAt: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate.toISOString() : new Date(0).toISOString(),
        source: source ?? (typeof item.source === "object" ? String((item.source as { "#text"?: string })["#text"] ?? "") || null : null),
        snippet: extractSnippet(descriptionHtml, title),
        imageUrl: extractImage(descriptionHtml),
      };
    });
    cache.set(company, { items: newsItems, fetchedAt: Date.now() });
    return newsItems;
  } catch {
    return cached?.items ?? [];
  }
}
