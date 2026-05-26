import { PlatformAdapter, SourcePostInput } from "./types";

export class Mobile01Adapter implements PlatformAdapter {
  source = "mobile01" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    throw new Error("Mobile01 直接 adapter 尚未實作真實抓取；請使用公開搜尋結果監控，不回傳空陣列假裝成功。");
  }
}
