/**
 * Tiny safe formula engine for computed columns (Excel-style, per-row).
 * Supports: numbers, column refs (bare words or [Bracketed Names] for names
 * with spaces), + - * / and parentheses. Never uses eval.
 *
 *   Revenue / Clicks
 *   [Total Adspend] * 1.2
 *   (Revenue - [Total Adspend]) / [Total Adspend]
 */

export type Ast =
  | { kind: "num"; value: number }
  | { kind: "ref"; name: string }
  | { kind: "neg"; operand: Ast }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Ast; right: Ast };

interface Token {
  type: "num" | "ref" | "op";
  value: string;
}

const tokenize = (src: string): Token[] => {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+/.exec(src.slice(i));
      if (!m) throw new Error(`Invalid number at position ${i + 1}`);
      out.push({ type: "num", value: m[0] });
      i += m[0].length;
    } else if (ch === "[") {
      const end = src.indexOf("]", i);
      if (end < 0) throw new Error("Missing closing ] in column reference");
      const name = src.slice(i + 1, end).trim();
      if (!name) throw new Error("Empty column reference []");
      out.push({ type: "ref", value: name });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))!;
      out.push({ type: "ref", value: m[0] });
      i += m[0].length;
    } else if ("+-*/()".includes(ch)) {
      out.push({ type: "op", value: ch });
      i++;
    } else {
      throw new Error(`Unexpected character "${ch}" in formula`);
    }
  }
  return out;
};

/** Parse a formula (leading "=" allowed, like Excel). Throws Error with a friendly message. */
export function parseFormula(src: string): Ast {
  const tokens = tokenize(src.replace(/^\s*=/, ""));
  let pos = 0;

  const peek = () => tokens[pos];
  const takeOp = (...ops: string[]) => {
    const t = tokens[pos];
    if (t?.type === "op" && ops.includes(t.value)) {
      pos++;
      return t.value;
    }
    return null;
  };

  const factor = (): Ast => {
    if (takeOp("-")) return { kind: "neg", operand: factor() };
    if (takeOp("+")) return factor();
    if (takeOp("(")) {
      const inner = expr();
      if (!takeOp(")")) throw new Error("Missing closing parenthesis");
      return inner;
    }
    const t = peek();
    if (t?.type === "num") {
      pos++;
      return { kind: "num", value: Number(t.value) };
    }
    if (t?.type === "ref") {
      pos++;
      return { kind: "ref", name: t.value };
    }
    throw new Error("Expected a number, column name, or ( in formula");
  };

  const term = (): Ast => {
    let node = factor();
    for (let op = takeOp("*", "/"); op; op = takeOp("*", "/")) {
      node = { kind: "bin", op: op as "*" | "/", left: node, right: factor() };
    }
    return node;
  };

  const expr = (): Ast => {
    let node = term();
    for (let op = takeOp("+", "-"); op; op = takeOp("+", "-")) {
      node = { kind: "bin", op: op as "+" | "-", left: node, right: term() };
    }
    return node;
  };

  const ast = expr();
  if (pos < tokens.length) throw new Error("Unexpected content at the end of the formula");
  return ast;
}

export function referencedNames(ast: Ast): string[] {
  switch (ast.kind) {
    case "ref":
      return [ast.name];
    case "neg":
      return referencedNames(ast.operand);
    case "bin":
      return [...referencedNames(ast.left), ...referencedNames(ast.right)];
    default:
      return [];
  }
}

/** Evaluate per row. Any missing/non-numeric operand or division by zero yields null (blank cell). */
export function evaluate(ast: Ast, resolve: (name: string) => number | null): number | null {
  switch (ast.kind) {
    case "num":
      return ast.value;
    case "ref": {
      const v = resolve(ast.name);
      return v != null && Number.isFinite(v) ? v : null;
    }
    case "neg": {
      const v = evaluate(ast.operand, resolve);
      return v == null ? null : -v;
    }
    case "bin": {
      const l = evaluate(ast.left, resolve);
      const r = evaluate(ast.right, resolve);
      if (l == null || r == null) return null;
      switch (ast.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? null : l / r;
      }
    }
  }
}
