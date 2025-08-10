const spaceRegex = /\s/;
const dqSpecialRegex = /[$`"\\]/;

type Options = {
  loose?: boolean;
};

/**
 * Tokenize a shell string into argv array
 */
export const tokenizeArgs = (
  argsString: string,
  options?: Options,
): string[] => {
  const tokens = [];
  let currentToken = "";
  let openningQuote: undefined | string;
  let escaped = false;
  for (let index = 0; index < argsString.length; index += 1) {
    const char = argsString[index];

    if (escaped) {
      // Backslashes are not recognized in single quotes, so `escaped`
      // is never true in this case.
      escaped = false;
      // In other regions, a newline and the preceding backslash
      // are always dropped.
      if (char !== "\n") {
        // In double quotes, special POSIX rules apply (see above).
        // For the characters <dollar-sign>, <backquote>,
        // <double-quote> and <backslash> the escaping backslash is
        // dropped. For all other characters the backslash is kept.
        if (openningQuote && ! dqSpecialRegex.test(char)) {
          currentToken += "\\";
        }
        // All other characters are kept as is.
        currentToken += char;
      }
      continue;
    }

    if (openningQuote !== "'") {
      if (char === "\\") {
        escaped = true;
        continue;
      }
    }

    if (openningQuote === undefined && spaceRegex.test(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }

    if (char === "'" || char === '"') {
      if (openningQuote === undefined) {
        openningQuote = char;
        continue;
      }
      if (openningQuote === char) {
        openningQuote = undefined;
        continue;
      }
    }

    currentToken += char;
  }
  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }
  if (options?.loose) {
    return tokens;
  }
  if (openningQuote) {
    throw Error("Unexpected end of string. Closing quote is missing.");
  }
  return tokens;
};
