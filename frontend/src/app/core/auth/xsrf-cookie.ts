/**
 * Double-submit CSRF cookie helper (spec: frontend-http-auth, design decision
 * D8 / "cookie helper location, shape, and testability"). {@link readCookie}
 * is a pure parser so cookie-string edge cases can be tested without a DOM.
 * {@link xsrfHeader} is the only caller that touches `Document`, via
 * Angular's `DOCUMENT` injection token — never `document` directly.
 */
export function readCookie(name: string, cookieString: string): string | null {
  if (!cookieString) {
    return null;
  }

  for (const pair of cookieString.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = pair.slice(0, separatorIndex).trim();
    if (key === name) {
      return pair.slice(separatorIndex + 1).trim();
    }
  }

  return null;
}

/** Empty object when no XSRF-TOKEN cookie is present — never fabricate a header. */
export function xsrfHeader(doc: Document): Record<string, string> {
  const token = readCookie('XSRF-TOKEN', doc.cookie);
  return token === null ? {} : { 'X-XSRF-TOKEN': token };
}
