export type SourceName = "threads" | "dcard" | "ptt" | "facebook" | "mobile01" | "search_engine";

export type SourcePostInput = {
  source: SourceName;
  externalId?: string;
  url?: string;
  title?: string;
  authorName?: string;
  content: string;
  snippet?: string;
  publishedAt?: Date;
  rawJson?: unknown;
  isMock?: boolean;
};

export interface PlatformAdapter {
  source: SourceName;
  fetchLatest(): Promise<SourcePostInput[]>;
}
