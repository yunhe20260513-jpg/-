import { searchQueries, toSearchQuery } from "../config/searchQueries";

const labels: Record<string, string> = {
  threads: "Threads",
  dcard: "Dcard",
  ptt: "PTT",
  mobile01: "Mobile01",
  facebook: "Facebook 公開頁面"
};

export function buildSearchLinks() {
  const grouped = new Map<string, ReturnType<typeof buildLink>[]>();

  for (const config of searchQueries) {
    const link = buildLink(config);
    grouped.set(config.source, [...(grouped.get(config.source) ?? []), link]);
  }

  return [...grouped.entries()].map(([platform, links]) => ({
    name: labels[platform] ?? platform,
    platform,
    links
  }));
}

function buildLink(config: (typeof searchQueries)[number]) {
  const query = toSearchQuery(config);
  return {
    query,
    keyword: config.terms.join(" "),
    site: config.site,
    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bingUrl: `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  };
}
