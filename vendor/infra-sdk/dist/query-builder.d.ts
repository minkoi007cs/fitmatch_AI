import type { InfraClientOptions, Result } from './types.js';
export interface BuilderAuth {
    /** Options carrying this request's access token. */
    prepare: () => Promise<InfraClientOptions>;
    /** Runs the call, refreshing and retrying once if the server says the token is stale. */
    retry: <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
}
export type JsonScalar = string | number | boolean | null;
export type QueryFilter = {
    column: string;
    op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
    value: JsonScalar;
} | {
    column: string;
    op: 'ilike';
    value: string;
} | {
    column: string;
    op: 'in' | 'not_in';
    values: JsonScalar[];
} | {
    column: string;
    op: 'is_null' | 'is_not_null';
};
/** A total computed by the database. `count` without a column counts rows. */
export type AggregateMeasure = {
    fn: 'count';
    column?: string;
    as?: string;
} | {
    fn: 'sum' | 'avg' | 'min' | 'max';
    column: string;
    as?: string;
};
/** A column to group by, or a timestamp grouped by calendar day / month (`YYYY-MM-DD` / `YYYY-MM`). */
export type AggregateGroup = string | {
    column: string;
    bucket?: 'day' | 'month';
    utcOffsetMinutes?: number;
};
export interface AggregatePayload {
    groupBy?: AggregateGroup[];
    measures: AggregateMeasure[];
}
export interface QueryPayload {
    action: 'select' | 'insert' | 'update' | 'delete';
    select?: string[];
    filters?: QueryFilter[];
    order?: Array<{
        column: string;
        direction: 'asc' | 'desc';
    }>;
    limit?: number;
    offset?: number;
    values?: Record<string, JsonScalar> | Array<Record<string, JsonScalar>>;
    returning?: string[];
    aggregate?: AggregatePayload;
}
export interface QueryResponse<R> {
    rows: R[];
    rowCount: number;
    durationMs: number;
}
export declare class QueryBuilder<R = Record<string, unknown>> {
    private readonly options;
    private readonly resource;
    /**
     * Supplied by the server client so each call carries that request's own access token and
     * retries once on a 401. Absent in the browser client, where the options already hold
     * everything and there is only ever one user.
     */
    private readonly auth?;
    private readonly filters;
    private readonly orderTerms;
    private columns;
    private returningColumns;
    private action;
    private rows;
    private limitValue;
    private offsetValue;
    private aggregateValue;
    constructor(options: InfraClientOptions, resource: string,
    /**
     * Supplied by the server client so each call carries that request's own access token and
     * retries once on a 401. Absent in the browser client, where the options already hold
     * everything and there is only ever one user.
     */
    auth?: BuilderAuth | undefined);
    /** Accepts `select('id', 'title')` or `select(['id', 'title'])` — both spellings are common. */
    select(...columns: Array<string | string[]>): this;
    eq(column: string, value: JsonScalar): this;
    neq(column: string, value: JsonScalar): this;
    gt(column: string, value: JsonScalar): this;
    gte(column: string, value: JsonScalar): this;
    lt(column: string, value: JsonScalar): this;
    lte(column: string, value: JsonScalar): this;
    /** Case-insensitive on every provider — see FILTER_OPERATORS in the core grammar. */
    ilike(column: string, pattern: string): this;
    in(column: string, values: JsonScalar[]): this;
    notIn(column: string, values: JsonScalar[]): this;
    isNull(column: string): this;
    isNotNull(column: string): this;
    orderBy(column: string, direction?: 'asc' | 'desc'): this;
    /** Alias of orderBy, for people arriving from a Supabase-shaped client. */
    order(column: string, direction?: 'asc' | 'desc'): this;
    limit(count: number): this;
    offset(count: number): this;
    /**
     * Let the database add things up instead of downloading rows: every row this user may read is
     * counted, not just the first 1 000. Each result row has the group columns plus one key per
     * measure (`as`, or `sum_amount`-style when omitted). `order` may use either; `limit` counts groups.
     *
     *   .aggregate({ groupBy: [{ column: 'created_at', bucket: 'day', utcOffsetMinutes: 420 }],
     *                measures: [{ fn: 'sum', column: 'amount', as: 'revenue' }] })
     *
     * `sum` / `avg` of a `numeric` column arrive as strings on Postgres — wrap them in `Number()`.
     */
    aggregate(spec: AggregatePayload): this;
    returning(...columns: string[]): this;
    insert(values: Record<string, JsonScalar> | Array<Record<string, JsonScalar>>): this;
    update(values: Record<string, JsonScalar>): this;
    delete(): this;
    /** The JSON that goes on the wire. Exposed so a caller can inspect or log it before sending. */
    toJSON(): QueryPayload;
    run(): Promise<Result<QueryResponse<R>>>;
    /** Alias of run(). */
    execute(): Promise<Result<QueryResponse<R>>>;
    /** Convenience for the common case — just the rows. */
    rowsOnly(): Promise<Result<R[]>>;
    /** Awaiting the builder directly runs it, so `await infra.from('notes').eq(...)` works. */
    then<TResult1 = Result<QueryResponse<R>>, TResult2 = never>(onfulfilled?: ((value: Result<QueryResponse<R>>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
}
//# sourceMappingURL=query-builder.d.ts.map
