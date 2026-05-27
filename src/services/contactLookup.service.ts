import { searchPublicWeb } from "./publicSearch.service";

export type ContactLookupResult = {
  query: string;
  phones: string[];
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  status: "found" | "no_result";
  note: string;
};

const phoneRegexes = [
  /(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g,
  /0[2-8][-.\s]?\d{3,4}[-.\s]?\d{4}/g,
  /\(0[2-8]\)\s?\d{3,4}[-.\s]?\d{4}/g
];

const badPhonePatterns = [/^0800/, /^0080/, /^000/, /^099999/];

export async function lookupCompanyContact(input: { name: string; address?: string; taxId?: string }): Promise<ContactLookupResult> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    return {
      query: "",
      phones: [],
      sources: [],
      status: "no_result",
      note: "缺少公司名稱，無法查詢。"
    };
  }

  const districtHint = input.address ? extractLocationHint(input.address) : "桃園";
  const query = `${cleanName} ${districtHint} 電話 聯絡方式`;
  const results = await searchPublicWeb(query);
  const sources = results.slice(0, 8).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.snippet
  }));
  const haystack = sources.map((source) => `${source.title}\n${source.snippet}\n${source.url}`).join("\n");
  const phones = normalizePhones(extractPhones(haystack));

  return {
    query,
    phones,
    sources,
    status: phones.length ? "found" : "no_result",
    note: phones.length
      ? "這是公開搜尋結果擷取到的疑似電話，請人工確認來源頁面後再使用。"
      : "公開搜尋沒有找到明確電話；可改查 Google Maps、104/1111 或公司官網。"
  };
}

function extractPhones(text: string) {
  const phones: string[] = [];
  for (const regex of phoneRegexes) {
    for (const match of text.matchAll(regex)) phones.push(match[0]);
  }
  return phones;
}

function normalizePhones(values: string[]) {
  const normalized = values
    .map((value) => value.replace(/[^\d+]/g, ""))
    .map((value) => {
      if (value.startsWith("+8869")) return `0${value.slice(4)}`;
      if (value.startsWith("8869")) return `0${value.slice(3)}`;
      if (value.startsWith("+886")) return `0${value.slice(4)}`;
      if (value.startsWith("886")) return `0${value.slice(3)}`;
      return value;
    })
    .filter((value) => value.length >= 9 && value.length <= 11)
    .filter((value) => !badPhonePatterns.some((pattern) => pattern.test(value)));
  return [...new Set(normalized)].slice(0, 5);
}

function extractLocationHint(address: string) {
  const match = address.match(/(桃園區|中壢區|平鎮區|八德區|蘆竹區|龜山區|楊梅區|龍潭區|大溪區|大園區|觀音區|新屋區|復興區|青埔|南崁|內壢)/);
  return match ? `桃園 ${match[1]}` : "桃園";
}
