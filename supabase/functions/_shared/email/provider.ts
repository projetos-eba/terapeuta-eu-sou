import type {
  EmailProviderSender,
  EmailProviderSendInput,
  EmailProviderSendResult,
} from "./types.ts";

export interface EmailProvider {
  listSenders(): Promise<EmailProviderSender[]>;
  send(input: EmailProviderSendInput): Promise<EmailProviderSendResult>;
}
