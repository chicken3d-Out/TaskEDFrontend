const cache = new Map<string, Promise<string>>();

// Makes a signature picture solid black (keeping its shape and see-through paper), so it prints
// and photocopies clearly. Used for every signature on a Travel Authority.
export function blackenPng(url: string): Promise<string> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
          d.data[i] = 0; d.data[i + 1] = 0; d.data[i + 2] = 0;
          d.data[i + 3] = Math.min(255, Math.round(d.data[i + 3] * 1.4));
        }
        x.putImageData(d, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}
