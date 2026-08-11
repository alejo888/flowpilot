import { Component, inject, signal } from '@angular/core';

import { AccessNoticeStore } from '../../core/notifications/access-notice.store';

/**
 * Minimal authenticated landing page (spec: home route). Registered at `''`
 * — the default post-login destination and the fallback target `adminGuard`
 * redirects a denied non-admin user to. Reads and consumes
 * {@link AccessNoticeStore} exactly once on init so a pending "no access"
 * notice renders here and does not survive a reload.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="home">
      @if (notice(); as message) {
        <p data-testid="home-notice" class="home-notice">{{ message }}</p>
      }
      <h1>FlowPilot</h1>
    </div>
  `,
})
export class HomeComponent {
  private readonly accessNotice = inject(AccessNoticeStore);

  readonly notice = signal(this.accessNotice.consume());
}
