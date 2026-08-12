import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserSummary } from './user-summary.model';
import { UsersApiService } from './users-api.service';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UsersApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the full user directory', () => {
    const users: UserSummary[] = [
      { id: 7, name: 'Ada Lovelace', email: 'ada@flowpilot.local' },
      { id: 8, name: 'Alan Turing', email: 'alan@flowpilot.local' },
    ];
    let result: UserSummary[] | undefined;

    service.listUsers().subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(users);

    expect(result).toEqual(users);
  });
});
