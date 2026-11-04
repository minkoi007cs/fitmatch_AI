export function sessionState(result) {
    if (result.error === null)
        return result.data === null ? { status: 'anonymous' } : { status: 'authenticated', user: result.data };
    if (result.error.code === 'UNAUTHENTICATED')
        return { status: 'anonymous' };
    if (result.error.code === 'FORBIDDEN_SCOPE' || result.error.code === 'APP_SUSPENDED') {
        return { status: 'forbidden', requestId: result.error.requestId };
    }
    return { status: 'unavailable', requestId: result.error.requestId };
}
//# sourceMappingURL=session-state.js.map