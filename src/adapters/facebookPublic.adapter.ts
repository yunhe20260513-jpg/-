import { PlatformAdapter, SourcePostInput } from "./types";

export class FacebookPublicAdapter implements PlatformAdapter {
  source = "facebook" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    throw new Error("Facebook 公開頁直接抓取尚未可靠實作；不可用時不回傳空陣列假裝成功。");
  }
}
