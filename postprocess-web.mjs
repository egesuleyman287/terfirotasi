import { readFile, writeFile } from 'node:fs/promises';

const pagePath = new URL('./dist/index.html', import.meta.url);
let page = await readFile(pagePath, 'utf8');

// Expo's default web template is English. The application content is Turkish,
// so declare it explicitly to prevent browsers from showing a translation prompt.
page = page
  .replace('<html lang="en">', '<html lang="tr">')
  .replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n    <meta http-equiv="content-language" content="tr" />');

await writeFile(pagePath, page, 'utf8');
