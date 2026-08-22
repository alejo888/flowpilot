import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProfileApiService } from './profile-api.service';
import { UserProfile } from './profile.model';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProfileApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the caller own profile', () => {
    const profile: UserProfile = {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@flowpilot.local',
      role: 'MIEMBRO_EQUIPO',
      active: true,
    };
    let result: UserProfile | undefined;

    service.getCurrentUser().subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.method).toBe('GET');
    req.flush(profile);

    expect(result).toEqual(profile);
  });

  it('sends a change-password request', () => {
    let completed = false;

    service
      .changePassword({ currentPassword: 'oldSecret1', newPassword: 'newSecret1' })
      .subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/users/me/password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ currentPassword: 'oldSecret1', newPassword: 'newSecret1' });
    req.flush(null);

    expect(completed).toBe(true);
  });
});
