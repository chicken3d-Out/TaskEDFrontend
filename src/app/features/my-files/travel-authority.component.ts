import { Component } from '@angular/core';
import { TaLogComponent } from './ta-log.component';

// Travel Authority (DepEd Order No. 043, s. 2022): apply, sign and the log.
// Old or scanned copies go in File Storage (from the My files menu).
@Component({
  selector: 'app-travel-authority',
  standalone: true,
  imports: [TaLogComponent],
  template: `
    <p class="muted">One Word file per Travel Authority is kept in <em>TaskEd Files</em> › <em>Working Directory</em> › <em>Travel Authority</em> in your own Google Drive, and is replaced with the signed version as people sign. Keep old or scanned copies in <strong>File Storage</strong>.</p>
    <app-ta-log />
  `,
  styles: [`.muted { color: #6b7280; font-size: .88rem; margin: 0 0 .8rem; }`],
})
export class TravelAuthorityComponent {}
