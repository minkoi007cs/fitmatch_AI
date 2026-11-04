/**
 * `infra.from('notes').select('id', 'title').eq('done', false)` — the fluent face of the query DSL.
 *
 * The builder produces the same JSON the gateway validates; it has no privileges of its own and
 * skipping it changes nothing, because the server re-parses whatever arrives. That is the point: a
 * builder that the server trusted would be a builder an attacker could simply not use.
 *
 * It is a thin layer by design. Every method either appends a filter or sets a field, and the
 * terminal `run()` is the only thing that touches the network — so a half-built query costs
 * nothing and a typo is a TypeScript error rather than a silent unfiltered read.
 */
import { request } from './http.js';
export class QueryBuilder {
    options;
    resource;
    auth;
    filters = [];
    orderTerms = [];
    columns = [];
    returningColumns = [];
    action = 'select';
    rows;
    limitValue;
    offsetValue;
    aggregateValue;
    constructor(options, resource,
    /**
     * Supplied by the server client so each call carries that request's own access token and
     * retries once on a 401. Absent in the browser client, where the options already hold
     * everything and there is only ever one user.
     */
    auth) {
        this.options = options;
        this.resource = resource;
        this.auth = auth;
    }
    /** Accepts `select('id', 'title')` or `select(['id', 'title'])` — both spellings are common. */
    select(...columns) {
        this.columns = columns.flat();
        return this;
    }
    eq(column, value) {
        this.filters.push({ column, op: 'eq', value });
        return this;
    }
    neq(column, value) {
        this.filters.push({ column, op: 'neq', value });
        return this;
    }
    gt(column, value) {
        this.filters.push({ column, op: 'gt', value });
        return this;
    }
    gte(column, value) {
        this.filters.push({ column, op: 'gte', value });
        return this;
    }
    lt(column, value) {
        this.filters.push({ column, op: 'lt', value });
        return this;
    }
    lte(column, value) {
        this.filters.push({ column, op: 'lte', value });
        return this;
    }
    /** Case-insensitive on every provider — see FILTER_OPERATORS in the core grammar. */
    ilike(column, pattern) {
        this.filters.push({ column, op: 'ilike', value: pattern });
        return this;
    }
    in(column, values) {
        this.filters.push({ column, op: 'in', values });
        return this;
    }
    notIn(column, values) {
        this.filters.push({ column, op: 'not_in', values });
        return this;
    }
    isNull(column) {
        this.filters.push({ column, op: 'is_null' });
        return this;
    }
    isNotNull(column) {
        this.filters.push({ column, op: 'is_not_null' });
        return this;
    }
    orderBy(column, direction = 'asc') {
        this.orderTerms.push({ column, direction });
        return this;
    }
    /** Alias of orderBy, for people arriving from a Supabase-shaped client. */
    order(column, direction = 'asc') {
        return this.orderBy(column, direction);
    }
    limit(count) {
        this.limitValue = count;
        return this;
    }
    offset(count) {
        this.offsetValue = count;
        return this;
    }
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
    aggregate(spec) {
        this.aggregateValue = spec;
        return this;
    }
    returning(...columns) {
        this.returningColumns = columns;
        return this;
    }
    insert(values) {
        this.action = 'insert';
        this.rows = values;
        return this;
    }
    update(values) {
        this.action = 'update';
        this.rows = values;
        return this;
    }
    delete() {
        this.action = 'delete';
        return this;
    }
    /** The JSON that goes on the wire. Exposed so a caller can inspect or log it before sending. */
    toJSON() {
        const payload = { action: this.action };
        if (this.columns.length > 0)
            payload.select = this.columns;
        if (this.filters.length > 0)
            payload.filters = this.filters;
        if (this.orderTerms.length > 0)
            payload.order = this.orderTerms;
        if (this.limitValue !== undefined)
            payload.limit = this.limitValue;
        if (this.offsetValue !== undefined)
            payload.offset = this.offsetValue;
        if (this.rows !== undefined)
            payload.values = this.rows;
        if (this.returningColumns.length > 0)
            payload.returning = this.returningColumns;
        if (this.aggregateValue !== undefined)
            payload.aggregate = this.aggregateValue;
        return payload;
    }
    async run() {
        const path = `/api/v1/data/${encodeURIComponent(this.resource)}`;
        const body = this.toJSON();
        if (this.auth === undefined) {
            return request(this.options, { method: 'POST', path, body, useApiKey: true });
        }
        const base = await this.auth.prepare();
        return this.auth.retry((headers) => request({ ...base, headers: { ...(base.headers ?? {}), ...headers } }, { method: 'POST', path, body, useApiKey: true }));
    }
    /** Alias of run(). */
    async execute() {
        return this.run();
    }
    /** Convenience for the common case — just the rows. */
    async rowsOnly() {
        const result = await this.run();
        if (result.error !== null)
            return { data: null, error: result.error };
        return { data: result.data.rows, error: null };
    }
    /** Awaiting the builder directly runs it, so `await infra.from('notes').eq(...)` works. */
    then(onfulfilled, onrejected) {
        return this.run().then(onfulfilled, onrejected);
    }
}
//# sourceMappingURL=query-builder.js.map
