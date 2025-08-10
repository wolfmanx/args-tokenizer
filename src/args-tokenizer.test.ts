import { expect, test } from "vitest";
import { tokenizeArgs } from "./args-tokenizer";

test("single command", () => {
  expect(tokenizeArgs("command")).toEqual(["command"]);
});

test("space separated arguments", () => {
  expect(tokenizeArgs(`command \targument`)).toEqual(["command", "argument"]);
});

test("quoted arguments", () => {
  expect(tokenizeArgs(`command 'argument1' "argument2"`)).toEqual([
    "command",
    "argument1",
    "argument2",
  ]);
});

test("inconsistently quoted arguments", () => {
  expect(tokenizeArgs(`command "arg"um"en"t`)).toEqual(["command", "argument"]);
});

test("detects incomplete quotes ", () => {
  expect(() => {
    tokenizeArgs(`command "arg1 "arg2" "arg3"`);
  }).toThrow("Unexpected end of string. Closing quote is missing.");
});

test("forgive incomplete quotes in loose mode", () => {
  expect(tokenizeArgs(`command "arg1 "arg2" "arg3"`, { loose: true })).toEqual([
    "command",
    "arg1 arg2 arg3",
  ]);
});

test("escape quotes and spaces with other quotes", () => {
  expect(tokenizeArgs(`command 'quote "' "quote '"`)).toEqual([
    "command",
    'quote "',
    "quote '",
  ]);
});

test("escape quotes with backslashes", () => {
  expect(tokenizeArgs(`command "project \\"argument\\""`)).toEqual([
    "command",
    'project "argument"',
  ]);
});

test("escape spaces with backslashes", () => {
  expect(tokenizeArgs(`command space\\ `)).toEqual(["command", "space "]);
});

test("remove escaped newlines outside of single quotes", () => {
  expect(tokenizeArgs(`command \\\nargument`)).toEqual(["command", `argument`]);
  expect(tokenizeArgs(`command "\\\nargument"`)).toEqual(["command", `argument`,]);
  expect(tokenizeArgs(`command '\\\nargument'`)).toEqual([
    "command",
    `\\\nargument`,
  ]);
});

test("flag argument", () => {
  expect(tokenizeArgs(`command --argument`)).toEqual(["command", "--argument"]);
});

test("flag argument with value", () => {
  expect(tokenizeArgs(`command --argument="value"`)).toEqual([
    "command",
    `--argument=value`,
  ]);
});

test("json argument", () => {
  expect(tokenizeArgs(`command '{ "param": "value" }'`)).toEqual([
    "command",
    `{ "param": "value" }`,
  ]);
});

test("multiline input", () => {
  expect(
    tokenizeArgs(`
      command \\
        --flag=1 \\
        "argument"
    `),
  ).toEqual(["command", "--flag=1", "argument"]);
});

test("multiline argument", () => {
  expect(
    tokenizeArgs(`command "query Posts {
  posts {
    slug
    title
    updatedAt
    excerpt
  }
}"`),
  ).toEqual([
    "command",
    `query Posts {
  posts {
    slug
    title
    updatedAt
    excerpt
  }
}`,
  ]);
});

test("empty command", () => {
  expect(tokenizeArgs(``)).toEqual([]);
  expect(tokenizeArgs(`  `)).toEqual([]);
});

// --------------------------------------------------
// Characters and character codes
// --------------------------------------------------

// special characters
const CHR_BS = "\\";
// special character codes
const ASC_NL = "\n".charCodeAt(0);
const ASC_DQ = '"'.charCodeAt(0);
const ASC_SQ = "'".charCodeAt(0);
const ASC_DOLLAR = "$".charCodeAt(0);
const ASC_AT = "@".charCodeAt(0);
const ASC_BS = CHR_BS.charCodeAt(0);
const ASC_BQ = "`".charCodeAt(0);
// characters that vanish, when escaped with a backslash
// <backslash><newline> is a line continuation, that should be removed
const skip_escaped_unquoted = [ASC_NL];
const skip_escaped_double = [ASC_NL];
const skip_escaped_single = [ASC_SQ];
// characters that are unescaped in a double quoting context
const escaped_double = [ASC_DQ, ASC_DOLLAR, ASC_BQ, ASC_BS];

// --------------------------------------------------
// Expected unescaped result crafted according to POSIX standard
// --------------------------------------------------

// characters escaped with a backslash in 2 parts
let chars_escaped_1: string[] = [];
let chars_escaped_2: string[] = [];

// expected results for unescaped characters depending on context
let chars_unescaped_unquoted: string[] = [];
let chars_unescaped_double: string[] = [];
let chars_unescaped_single: string[] = [];

let arg_string_unquoted: string;
let arg_string_double: string;
let arg_string_single: string;

let arg_tokens_unquoted: string[] = [];
let arg_tokens_double: string[] = [];
let arg_tokens_single: string[] = [];

function add_char_to_unescaped_arrays(ascii_code: number, escaped_chars: string[]) {
  let _chr = String.fromCharCode(ascii_code);
  escaped_chars.push(CHR_BS + _chr);

  if (skip_escaped_unquoted.indexOf(ascii_code) < 0) {
    // all characters are unescaped
    chars_unescaped_unquoted.push(_chr);
  }
  if (skip_escaped_double.indexOf(ascii_code) < 0) {
    // only some characters are unescaped
    if (escaped_double.indexOf(ascii_code) < 0) {
      chars_unescaped_double.push(CHR_BS + _chr);
    } else {
      chars_unescaped_double.push(_chr);
    }
  }
  if (skip_escaped_single.indexOf(ascii_code) < 0) {
    // no characters are unescaped
    chars_unescaped_single.push(CHR_BS + _chr);
  } else {
    // a single quote terminates single quoting
    chars_unescaped_single.push(CHR_BS);
  }
}

type Overrides = {
  tokens_unquoted?: string[];
  tokens_double?: string[];
  tokens_single?: string[];
}

function chars_escaped_test_generate_strings (start: number, end: number, overrides?: Overrides) {
  chars_escaped_1= [];
  chars_escaped_2 = [];
  chars_unescaped_unquoted = [];
  chars_unescaped_double = [];
  chars_unescaped_single = [];
  arg_tokens_unquoted = [];
  arg_tokens_double = [];
  arg_tokens_single = [];

  if (typeof(overrides) === 'undefined') {
    overrides = {};
  }

  // the first part of escaped characters are all characters from
  // 0 - ASC(single_quote) "\000 ... '"
  for(let ascii_code=start; ascii_code<=ASC_SQ; ascii_code++) {
    add_char_to_unescaped_arrays(ascii_code, chars_escaped_1);
  }
  // The second part are all characters from
  // ASC(<open-parenthesis>) - ASC(255) "( ... ÿ"
  for(let ascii_code=ASC_SQ+1; ascii_code<=end; ascii_code++) {
    add_char_to_unescaped_arrays(ascii_code, chars_escaped_2);
  }

  arg_string_unquoted = chars_escaped_1.join("") + chars_escaped_2.join("");
  arg_string_double = '"' + chars_escaped_1.join("") + chars_escaped_2.join("") + '"';
  // Since a single quote cannot be a member of a single quoted string,
  // the escaped single quote at the end of the first part will
  // terminate single-quoting. To avoid a syntax error, a single quote
  // must be prepended to the second part of escaped characters.
  arg_string_single = "'" + chars_escaped_1.join("") + "'" + chars_escaped_2.join("") + "'";

  arg_tokens_unquoted = overrides.tokens_unquoted ? overrides.tokens_unquoted : [chars_unescaped_unquoted.join("")];
  arg_tokens_double = overrides.tokens_double ? overrides.tokens_double : [chars_unescaped_double.join("")];
  arg_tokens_single = overrides.tokens_single ? overrides.tokens_single : [chars_unescaped_single.join("")];
}

// --------------------------------------------------
// Expected unescaped result generated by /bin/sh
// --------------------------------------------------

let shell_arg_token_unquoted = atob(`
AQIDBAUGBwgJCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6
Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJz
dHV2d3h5ent8fX5/
`);

let shell_arg_token_double = atob(`
XAFcAlwDXARcBVwGXAdcCFwJXAtcDFwNXA5cD1wQXBFcElwTXBRcFVwWXBdcGFwZXBpcG1wcXB1c
HlwfXCBcISJcIyRcJVwmXCdcKFwpXCpcK1wsXC1cLlwvXDBcMVwyXDNcNFw1XDZcN1w4XDlcOlw7
XDxcPVw+XD9cQFxBXEJcQ1xEXEVcRlxHXEhcSVxKXEtcTFxNXE5cT1xQXFFcUlxTXFRcVVxWXFdc
WFxZXFpcW1xcXVxeXF9gXGFcYlxjXGRcZVxmXGdcaFxpXGpca1xsXG1cblxvXHBccVxyXHNcdFx1
XHZcd1x4XHlcelx7XHxcfVx+XH8=
`);

let shell_arg_token_single = atob(`
XAFcAlwDXARcBVwGXAdcCFwJXApcC1wMXA1cDlwPXBBcEVwSXBNcFFwVXBZcF1wYXBlcGlwbXBxc
HVweXB9cIFwhXCJcI1wkXCVcJlxcKFwpXCpcK1wsXC1cLlwvXDBcMVwyXDNcNFw1XDZcN1w4XDlc
Olw7XDxcPVw+XD9cQFxBXEJcQ1xEXEVcRlxHXEhcSVxKXEtcTFxNXE5cT1xQXFFcUlxTXFRcVVxW
XFdcWFxZXFpcW1xcXF1cXlxfXGBcYVxiXGNcZFxlXGZcZ1xoXGlcalxrXGxcbVxuXG9ccFxxXHJc
c1x0XHVcdlx3XHhceVx6XHtcfFx9XH5cfw==
`);

// function fold_string (str: string, width?: number) {
//   let lines = [];
//   if (typeof(width) === 'undefined') {
//     width = 76;
//   }
//   while (str) {
//     lines.push(str.substring(0, width));
//     str = str.substring(width);
//   }
//   return lines.join("\n");
// }
//
// async function generate_shell_arg_tokens () {
//   // result.stdout - the stdout as a string
//   // result.stderr - the stderr as a string
//   // result.exitCode - the process exit code as a number
//   let result = await x('/bin/sh', ['-c', `pecho () { printf "%s" "\${*}"; }; pecho ` + arg_string_unquoted]);
//   console.log('let shell_arg_token_unquoted = atob(`' + "\n" + fold_string(btoa(result.stdout)) + '`)';);
//   result = await x('/bin/sh', ['-c', `pecho () { printf "%s" "\${*}"; }; pecho ` + arg_string_double]);
//   console.log('let shell_arg_token_double = atob(`' + "\n" + fold_string(btoa(result.stdout)) + '`)');
//   result = await x('/bin/sh', ['-c', `pecho () { printf "%s" "\${*}"; }; pecho ` + arg_string_single]);
//   console.log('let shell_arg_token_single = atob(`' + "\n" + fold_string(btoa(result.stdout)) + '`)');
// }

// import { x } from 'tinyexec';
// // tinyexec does not handle NUL in argument strings, ASCII codes > 127 are messed up by UTF-8 output
// chars_escaped_test_generate_strings(1, 127);
// await generate_shell_arg_tokens();

function pretty_print_character_string_array(char_string_array: string[]) {
  let output = [];
  for (const _string of char_string_array) {
    output.push("--------------------------------------------------");
    let _escaped = "";
    for (let _indx=0; _indx<_string.length; _indx++) {
      let _chr = _string[_indx];
      let _asc = _chr.charCodeAt(0);
      if (!_escaped) {
        if (_chr === CHR_BS) {
          _escaped = _chr;
          continue
        }
      }
      if (_asc < 32) {
        _chr = "^" + String.fromCharCode(ASC_AT + _asc);
      } else if (_asc >= 127) {
        _chr = "\\x" + _asc.toString(16).toUpperCase();
      }
      output.push(_escaped + _chr + " " + _asc.toString());
      _escaped = "";
    }
    if (_escaped) {
      output.push(_escaped);
    }
  }
  return output.join("\n");
}

function chars_escaped_test(start: number, end: number, suffix: string, overrides?: Overrides) {
  chars_escaped_test_generate_strings(start, end, overrides);

  if (suffix) {
    suffix = " " + suffix;
  }

  test("all escaped characters outside quoting context" + suffix, () => {
    expect(
      pretty_print_character_string_array(
        tokenizeArgs(arg_string_unquoted))
    ).toEqual(
      pretty_print_character_string_array(
        arg_tokens_unquoted)
    );
  });

  test("all escaped characters in double quoting context" + suffix, () => {
    expect(
      pretty_print_character_string_array(
        tokenizeArgs(arg_string_double))
    ).toEqual(
      pretty_print_character_string_array(
        arg_tokens_double)
    );
  });

  test("all escaped characters in single quoting context" + suffix, () => {
    expect(
      pretty_print_character_string_array(
        tokenizeArgs(arg_string_single))
    ).toEqual(
      pretty_print_character_string_array(
        arg_tokens_single)
    );
  });
}

// Expected unescaped result generated according to POSIX
chars_escaped_test(0, 255, "(POSIX)");

// Expected unescaped result generated by /bin/sh
chars_escaped_test(1, 127, "(/bin/sh)", {
  tokens_unquoted: [shell_arg_token_unquoted],
  tokens_double: [shell_arg_token_double],
  tokens_single: [shell_arg_token_single]
});
