import { Component, input } from '@angular/core';

export const FP_ICON_PATHS = {
  save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zM6 5h9v4H6V5z',
  comment: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.03 0-1.42l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.82z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z',
  close: 'M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.7 4.29 4.29l6.3 6.3 6.3-6.3z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  logout: 'M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  home: 'M12 3 4 9v12h6v-7h4v7h6V9l-8-6z', folder: 'M10 4H2v16h20V6H12l-2-2z', user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  users: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.96 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  shield: 'M12 2 4 5v6c0 5.25 3.4 10.17 8 11 4.6-.83 8-5.75 8-11V5l-8-3z', dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z', list: 'M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z', board: 'M4 4h6v16H4V4zm10 0h6v7h-6V4zm0 9h6v7h-6v-7z',
  'arrow-left': 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', 'external-link': 'M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59L7.76 14.83l1.41 1.41L19 6.41V10h2V3h-7z', check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z', refresh: 'M17.65 6.35A7.95 7.95 0 0 0 12 4V1L8 5l4 4V6c2.76 0 5 2.24 5 5a5 5 0 0 1-9.9 1H5.02A7 7 0 1 0 17.65 6.35z', key: 'M7 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-3h9v2h-2v2h-2v-2h-5V9z', play: 'M8 5v14l11-7z', 'check-circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z', 'user-off': 'M12 12c2.21 0 4-1.79 4-4 0-.58-.13-1.13-.35-1.62L7.62 14.4A7.97 7.97 0 0 1 12 13c2.67 0 8 1.34 8 4v2h-2v-2c0-1.33-3.33-2-6-2-1.05 0-2.17.1-3.14.29L7.7 17.45C9.08 17.16 10.66 17 12 17c1.67 0 4 .39 4 1v1H4.27L2 16.73 3.41 15.32 8.1 20H4v-2c0-2.66 5.33-4 8-4z'
} as const;

export type FpIconName = keyof typeof FP_ICON_PATHS;

@Component({
  selector: 'fp-icon',
  standalone: true,
  template: `<svg class="fp-icon" [attr.viewBox]="'0 0 24 24'" focusable="false" [attr.aria-hidden]="ariaLabel() ? null : 'true'" [attr.role]="ariaLabel() ? 'img' : null" [attr.aria-label]="ariaLabel()"><path [attr.d]="path()" /></svg>`,
  styles: `.fp-icon { display: inline-block; width: 1.125rem; height: 1.125rem; flex: 0 0 auto; fill: currentColor; }`,
})
export class FpIconComponent {
  readonly name = input.required<FpIconName>();
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly path = () => FP_ICON_PATHS[this.name()];
}
