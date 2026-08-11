import { sanitizeReturnUrl } from './return-url';

describe('sanitizeReturnUrl', () => {
  it('accepts a valid single-leading-slash relative path', () => {
    expect(sanitizeReturnUrl('/projects/1/board')).toBe('/projects/1/board');
  });

  it('accepts a relative path carrying query params', () => {
    expect(sanitizeReturnUrl('/admin/users?tab=active')).toBe('/admin/users?tab=active');
  });

  it('rejects a protocol-relative URL starting with //', () => {
    expect(sanitizeReturnUrl('//evil.com')).toBeNull();
  });

  it('rejects an absolute https URL', () => {
    expect(sanitizeReturnUrl('https://evil.com')).toBeNull();
  });

  it('rejects a backslash-prefixed protocol-relative URL', () => {
    expect(sanitizeReturnUrl('/\\evil.com')).toBeNull();
  });

  it('rejects a javascript: scheme value', () => {
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(sanitizeReturnUrl('')).toBeNull();
  });

  it('rejects an absent (null) value', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
  });

  it('rejects a path without a leading slash', () => {
    expect(sanitizeReturnUrl('projects/1/board')).toBeNull();
  });
});
