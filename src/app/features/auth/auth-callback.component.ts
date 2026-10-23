import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [LoadingComponent],
  template: `
    <div class="page">
      <app-loading label="Signing you in…" />
    </div>
  `,
  styles: [
    `
      .page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f5f7;
      }
    `,
  ],
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    this.auth.setToken(token);
    await this.auth.loadCurrentUser();
    this.router.navigateByUrl(this.auth.routeForCurrentState());
  }
}
