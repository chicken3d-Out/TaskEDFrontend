import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, LoadingComponent],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent implements OnInit {
  pending: User[] = [];
  loading = true;
  actingOn: string | null = null;

  constructor(private usersService: UsersService) {}

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading = true;
    this.usersService.pendingApprovals().subscribe((users) => {
      this.pending = users;
      this.loading = false;
    });
  }

  approve(user: User) {
    this.actingOn = user.id;
    this.usersService.approve(user.id).subscribe(() => this.load());
  }

  reject(user: User) {
    this.actingOn = user.id;
    this.usersService.reject(user.id).subscribe(() => this.load());
  }
}
