export type ImportedQuestion = {
  text: string;
  choices: string[];
  correctAnswer: number;
  reference?: string;
};

function unescapeJavaScriptText(value: string) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function field(objectText: string, name: string) {
  const match = objectText.match(new RegExp(`\\b${name}\\s*:\\s*["']((?:\\\\.|[^"'\\\\])*)["']`));
  return match ? unescapeJavaScriptText(match[1]) : undefined;
}

function referenceField(objectText: string) {
  return field(objectText, 'ref') ?? field(objectText, 'reference') ?? field(objectText, 'dayanak') ?? field(objectText, 'kaynak') ?? field(objectText, 'mevzuat') ?? field(objectText, 'source');
}

function questionObjects(arrayText: string) {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < arrayText.length; index += 1) {
    const char = arrayText[index];
    if (quote) {
      if (!escaped && char === quote) quote = '';
      escaped = !escaped && char === '\\';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') { if (depth === 0) start = index; depth += 1; }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) objects.push(arrayText.slice(start, index + 1));
    }
  }
  return objects;
}

/**
 * Reads the `const questions = [...]` data style used in Süleyman's sample files.
 * It does not execute uploaded HTML or JavaScript.
 */
export function importQuestionsFromHtml(source: string): ImportedQuestion[] {
  // Accept files where the question array is followed by another variable, a function or the end of a script.
  const array = source.match(/(?:const|let|var)\s+questions\s*=\s*\[([\s\S]*?)\];/i)?.[1];
  if (!array) return [];

  return questionObjects(array).flatMap(objectText => {
    const text = field(objectText, 'q');
    const optionsBlock = objectText.match(/\boptions\s*:\s*\[([\s\S]*?)\]\s*,\s*correct\s*:/)?.[1];
    const correct = objectText.match(/\bcorrect\s*:\s*(\d+)/)?.[1];
    const choices = optionsBlock
      ? Array.from(optionsBlock.matchAll(/"((?:\\.|[^"\\])*)"/g), match => unescapeJavaScriptText(match[1]))
      : [];

    if (!text || choices.length < 4 || correct === undefined) return [];
    return [{ text, choices, correctAnswer: Number(correct), reference: referenceField(objectText) }];
  });
}
