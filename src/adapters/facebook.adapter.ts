import { PlatformAdapter, SourcePostInput } from "./types";

export class FacebookAdapter implements PlatformAdapter {
  source = "facebook" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    throw new Error("Facebook 不登入、不使用 API；直接 adapter 不可用，請使用公開搜尋結果監控。");
  }
}
