// A small, dependency-free syntax highlighter. It doesn't aim for full
// grammar correctness — just enough visual structure (keywords, strings,
// comments, numbers) to make code examples easy to scan.

export interface Token {
  text: string;
  cls?: "keyword" | "string" | "comment" | "number" | "function" | "property" | "punct";
}

const KEYWORDS: Record<string, Set<string>> = {
  typescript: new Set(
    "const let var async await function return if else throw new import from export try catch finally class interface type extends implements public private static this void for while of in typeof as null undefined true false break continue switch case default".split(" "),
  ),
  javascript: new Set(
    "const let var async await function return if else throw new import from export try catch finally class extends this void for while of in typeof null undefined true false break continue switch case default".split(" "),
  ),
  sql: new Set(
    "select from where update set insert into values delete begin commit rollback create index on concurrently table primary key for update analyze explain and or not null is join left right inner order by group having limit unique foreign references constraint using".split(
      " ",
    ),
  ),
  lua: new Set("local function if then else elseif end return and or not nil true false while do".split(" ")),
  nginx: new Set("upstream server listen location proxy_pass proxy_set_header least_conn ssl".split(" ")),
};

function keywordSetFor(language: string): Set<string> {
  const lang = language.toLowerCase();
  return KEYWORDS[lang] ?? KEYWORDS.typescript;
}

const TOKEN_REGEX =
  /(\/\/[^\n]*|--[^\n]*|#[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|([{}()[\];:,.<>=+\-*/%!&|^~?]+)|(\s+)/g;

export function highlight(code: string, language: string): Token[] {
  const keywords = keywordSetFor(language);
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(code))) {
    if (match.index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, match.index) });
    }
    const [full, lineComment, blockComment, str, num, word, punct] = match;

    if (lineComment || blockComment) {
      tokens.push({ text: full, cls: "comment" });
    } else if (str) {
      tokens.push({ text: full, cls: "string" });
    } else if (num) {
      tokens.push({ text: full, cls: "number" });
    } else if (word) {
      const lower = word.toLowerCase();
      const nextChar = code[match.index + full.length];
      if (keywords.has(lower)) {
        tokens.push({ text: full, cls: "keyword" });
      } else if (nextChar === "(") {
        tokens.push({ text: full, cls: "function" });
      } else {
        tokens.push({ text: full });
      }
    } else if (punct) {
      tokens.push({ text: full, cls: "punct" });
    } else {
      tokens.push({ text: full });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex) });
  }

  return tokens;
}
