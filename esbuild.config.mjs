import { context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

const build = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', '@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/common'],
  format: 'cjs',
  target: 'es2020',
  outfile: 'main.js',
  sourcemap: 'inline',
  logLevel: 'info',
});
if (process.argv.includes('--watch')) {
  await build.watch();
} else {
  await build.rebuild();
  await build.dispose();
  await mkdir('dist/hex-preview', { recursive: true });
  for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    await copyFile(file, `dist/hex-preview/${file}`);
  }
}
