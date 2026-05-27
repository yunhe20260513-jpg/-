export type SignalType = "social" | "tender" | "company" | "hiring" | "move" | "competitor" | "contract" | "contract_maturity";

export type SignalInput = {
  type: SignalType;
  source: string;
  title: string;
  name?: string;
  url: string;
  summary?: string;
  rawJson?: unknown;
  publishedAt?: Date;
  fetchedAt?: Date;
};

export interface SignalAdapter {
  type: SignalType;
  source: string;
  fetchLatest(): Promise<SignalInput[]>;
}
