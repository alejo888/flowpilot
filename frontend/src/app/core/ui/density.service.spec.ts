import { TestBed } from '@angular/core/testing';

import { DensityService, FP_DENSITY_STORAGE_KEY } from './density.service';

describe('DensityService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-fp-density');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-fp-density');
  });

  it('defaults to comfortable when localStorage has no value', () => {
    const service = TestBed.inject(DensityService);

    expect(service.density()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-fp-density')).toBe('comfortable');
  });

  it('restores compact density from localStorage on creation', () => {
    localStorage.setItem(FP_DENSITY_STORAGE_KEY, 'compact');

    const service = TestBed.inject(DensityService);

    expect(service.density()).toBe('compact');
    expect(document.documentElement.getAttribute('data-fp-density')).toBe('compact');
  });

  it('falls back to comfortable for an unknown stored value', () => {
    localStorage.setItem(FP_DENSITY_STORAGE_KEY, 'ultra-cozy');

    const service = TestBed.inject(DensityService);

    expect(service.density()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-fp-density')).toBe('comfortable');
  });

  it('toggle() flips comfortable to compact and writes the attribute + localStorage', () => {
    const service = TestBed.inject(DensityService);

    service.toggle();

    expect(service.density()).toBe('compact');
    expect(document.documentElement.getAttribute('data-fp-density')).toBe('compact');
    expect(localStorage.getItem(FP_DENSITY_STORAGE_KEY)).toBe('compact');
  });

  it('toggle() flips compact back to comfortable and writes the attribute + localStorage', () => {
    localStorage.setItem(FP_DENSITY_STORAGE_KEY, 'compact');
    const service = TestBed.inject(DensityService);

    service.toggle();

    expect(service.density()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-fp-density')).toBe('comfortable');
    expect(localStorage.getItem(FP_DENSITY_STORAGE_KEY)).toBe('comfortable');
  });
});
