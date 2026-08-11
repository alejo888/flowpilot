import { TestBed } from '@angular/core/testing';

import { AccessNoticeStore } from './access-notice.store';

describe('AccessNoticeStore', () => {
  let store: AccessNoticeStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(AccessNoticeStore);
  });

  it('has no message by default', () => {
    expect(store.message()).toBeNull();
  });

  it('sets a denial message when denyAdmin() is called', () => {
    store.denyAdmin();

    expect(store.message()).toBe('No tienes acceso a esta sección.');
  });

  it('returns the message once from consume() then clears it', () => {
    store.denyAdmin();

    const first = store.consume();
    expect(first).toBe('No tienes acceso a esta sección.');
    expect(store.message()).toBeNull();

    const second = store.consume();
    expect(second).toBeNull();
  });
});
