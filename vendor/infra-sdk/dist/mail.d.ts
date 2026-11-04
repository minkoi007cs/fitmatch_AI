import type { InfraClientOptions, Result } from './types.js';
export interface SendMailInput {
    to: string;
    subject: string;
    text: string;
}
export interface InfraMailClient {
    send(input: SendMailInput): Promise<Result<{
        sent: boolean;
        to: string;
        subject: string;
    }>>;
}
export declare function createMailClient(options: InfraClientOptions): InfraMailClient;
//# sourceMappingURL=mail.d.ts.map