// Export Microsoft's required icon sizes from Tactic's existing vector mark.
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './build.mjs';

const source = readFileSync(join(ROOT, 'assets/tactic-mark.svg'), 'utf8');
const directory = join(ROOT, 'assets/cowork');
mkdirSync(directory, { recursive: true });
// Keep the solid white background and navy mark used by the mobile app icon.
await sharp(Buffer.from(source)).resize(128, 128)
  .extend({ top: 32, bottom: 32, left: 32, right: 32, background: '#ffffff' })
  .flatten({ background: '#ffffff' }).png().toFile(join(directory, 'color.png'));
// Microsoft uses a white mark on transparency for its compact outline icon.
await sharp(Buffer.from(source.replaceAll('#1B2559', '#ffffff'))).resize(28, 28)
  .extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#00000000' })
  .png().toFile(join(directory, 'outline.png'));
