import type { Result } from './types.js';
/** A transport or configuration failure is not evidence that the user signed out. */
export type SessionState<T> = {
    status: 'authenticated';
    user: T;
} | {
    status: 'anonymous';
} | {
    status: 'forbidden';
    requestId: string;
} | {
    status: 'unavailable';
    requestId: string;
};
export declare function sessionState<T>(result: Result<T | null>): SessionState<T>;
//# sourceMappingURL=session-state.d.ts.map