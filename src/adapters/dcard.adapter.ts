import { PlatformAdapter, SourcePostInput } from "./types";

export class DcardAdapter implements PlatformAdapter {
  source = "dcard" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    throw new Error("Dcard 直接 adapter 尚未實作真實抓取；請使用公開搜尋結果監控，不回傳空陣列假裝成功。");
  }
}
