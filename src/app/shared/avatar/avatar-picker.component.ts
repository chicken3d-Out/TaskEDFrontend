import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { UploadService } from '../../core/services/upload.service';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from '../icon/icon.component';

const SIZE = 256; // px, square

// Lets the user pick a photo, crops it to a centred square, shrinks it to a
// small JPEG in the browser, uploads it to Cloudinary and emits the URL.
@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [AvatarComponent, IconComponent],
  template: `
    <div class="picker">
      <div class="preview">
        <app-avatar [url]="url" [name]="name" [size]="96" />
        <label class="cam" [class.busy]="busy" title="Change photo">
          <app-icon name="camera" [size]="16" />
          <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFile($event)" hidden />
        </label>
      </div>
      <div class="text">
        <strong>Profile picture</strong>
        <span>{{ busy ? 'Uploading…' : 'JPG or PNG. It is resized automatically.' }}</span>
        @if (error) {
          <span class="err">{{ error }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .picker {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .preview {
        position: relative;
      }
      .cam {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--primary);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 2px solid #fff;
      }
      .cam.busy {
        opacity: 0.5;
        pointer-events: none;
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .text strong {
        color: var(--text);
      }
      .err {
        color: var(--danger);
      }
    `,
  ],
})
export class AvatarPickerComponent {
  private uploads = inject(UploadService);

  @Input() url: string | null | undefined;
  @Input() name: string | null | undefined;
  @Output() uploaded = new EventEmitter<string>();

  busy = false;
  error: string | null = null;

  async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error = null;
    this.busy = true;
    try {
      const blob = await this.toSquareJpeg(file);
      const link = await this.uploads.uploadAvatar(blob);
      this.url = link;
      this.uploaded.emit(link);
    } catch (e: any) {
      this.error = e?.message ?? 'Could not upload the picture.';
    } finally {
      this.busy = false;
    }
  }

  private toSquareJpeg(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('Your browser cannot process images.'));
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not process the picture.'))),
          'image/jpeg',
          0.85,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('That file is not a readable image.'));
      };
      img.src = objectUrl;
    });
  }
}
