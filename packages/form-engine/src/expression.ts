// Tiny safe expression language for calculated fields.
//
// Grammar:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := '-' factor | '(' expr ')' | number | identifier
//
// `identifier` references another field in the same scope. The evaluator
// resolves it from a values map. No function calls, no string ops, no
// boolean ops, no `eval` — the supported surface is exactly what's
// needed for ESG arithmetic (e.g., CO₂e = activity × emission_factor).

export type ExpressionAst =
  | { type: "number"; value: number }
  | { type: "ref"; id: string }
  | { type: "neg"; expr: ExpressionAst }
  | { type: "binary"; op: "+" | "-" | "*" | "/"; left: ExpressionAst; right: ExpressionAst };

export interface ParseError {
  ok: false;
  message: string;
  position: number;
}

export type ParseResult = { ok: true; ast: ExpressionAst } | ParseError;

export function parseExpression(source: string): ParseResult {
  const parser = new Parser(source);
  try {
    const ast = parser.parseExpr();
    parser.expectEnd();
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof ParserError) {
      return { ok: false, message: e.message, position: e.position };
    }
    throw e;
  }
}

export function collectReferences(ast: ExpressionAst): Set<string> {
  const refs = new Set<string>();
  walk(ast, (node) => {
    if (node.type === "ref") refs.add(node.id);
  });
  return refs;
}

function walk(ast: ExpressionAst, visit: (node: ExpressionAst) => void) {
  visit(ast);
  if (ast.type === "neg") walk(ast.expr, visit);
  if (ast.type === "binary") {
    walk(ast.left, visit);
    walk(ast.right, visit);
  }
}

export type EvaluateError =
  | { code: "missing_dependency"; refId: string }
  | { code: "non_numeric_dependency"; refId: string }
  | { code: "division_by_zero" };

export type EvaluateResult = { ok: true; value: number } | { ok: false; error: EvaluateError };

// Evaluates the AST against a scope of (already-validated) field values.
// Missing or non-numeric dependencies short-circuit with a typed error.
export function evaluateExpression(
  ast: ExpressionAst,
  scope: Record<string, unknown>,
): EvaluateResult {
  switch (ast.type) {
    case "number":
      return { ok: true, value: ast.value };
    case "ref": {
      if (!(ast.id in scope))
        return { ok: false, error: { code: "missing_dependency", refId: ast.id } };
      const raw = scope[ast.id];
      if (raw === undefined || raw === null || raw === "") {
        return { ok: false, error: { code: "missing_dependency", refId: ast.id } };
      }
      if (typeof raw === "number" && Number.isFinite(raw)) return { ok: true, value: raw };
      if (typeof raw === "string") {
        const parsed = Number(raw.trim().replace(",", "."));
        if (Number.isFinite(parsed)) return { ok: true, value: parsed };
      }
      return { ok: false, error: { code: "non_numeric_dependency", refId: ast.id } };
    }
    case "neg": {
      const inner = evaluateExpression(ast.expr, scope);
      return inner.ok ? { ok: true, value: -inner.value } : inner;
    }
    case "binary": {
      const left = evaluateExpression(ast.left, scope);
      if (!left.ok) return left;
      const right = evaluateExpression(ast.right, scope);
      if (!right.ok) return right;
      switch (ast.op) {
        case "+":
          return { ok: true, value: left.value + right.value };
        case "-":
          return { ok: true, value: left.value - right.value };
        case "*":
          return { ok: true, value: left.value * right.value };
        case "/":
          if (right.value === 0) return { ok: false, error: { code: "division_by_zero" } };
          return { ok: true, value: left.value / right.value };
      }
    }
  }
}

class ParserError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
  }
}

class Parser {
  private pos = 0;
  constructor(private readonly src: string) {}

  parseExpr(): ExpressionAst {
    let left = this.parseTerm();
    while (true) {
      this.skipWs();
      const ch = this.peek();
      if (ch === "+" || ch === "-") {
        this.advance();
        const right = this.parseTerm();
        left = { type: "binary", op: ch, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): ExpressionAst {
    let left = this.parseFactor();
    while (true) {
      this.skipWs();
      const ch = this.peek();
      if (ch === "*" || ch === "/") {
        this.advance();
        const right = this.parseFactor();
        left = { type: "binary", op: ch, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseFactor(): ExpressionAst {
    this.skipWs();
    const ch = this.peek();
    if (ch === undefined) throw new ParserError("Expressão incompleta.", this.pos);
    if (ch === "-") {
      this.advance();
      return { type: "neg", expr: this.parseFactor() };
    }
    if (ch === "(") {
      this.advance();
      const inner = this.parseExpr();
      this.skipWs();
      if (this.peek() !== ")") {
        throw new ParserError(`Esperado ')' na posição ${this.pos}.`, this.pos);
      }
      this.advance();
      return inner;
    }
    if (isDigit(ch) || ch === ".") {
      return this.parseNumber();
    }
    if (isIdentStart(ch)) {
      return this.parseIdent();
    }
    throw new ParserError(`Carácter inesperado "${ch}" na posição ${this.pos}.`, this.pos);
  }

  private parseNumber(): ExpressionAst {
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === undefined) break;
      if (isDigit(ch) || ch === "." || ch === "_") {
        this.pos++;
      } else {
        break;
      }
    }
    const raw = this.src.slice(start, this.pos).replaceAll("_", "");
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new ParserError(`Número inválido "${raw}".`, start);
    }
    return { type: "number", value };
  }

  private parseIdent(): ExpressionAst {
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === undefined) break;
      if (isIdentChar(ch)) {
        this.pos++;
      } else {
        break;
      }
    }
    const id = this.src.slice(start, this.pos);
    return { type: "ref", id };
  }

  expectEnd() {
    this.skipWs();
    if (this.pos < this.src.length) {
      throw new ParserError(
        `Conteúdo inesperado após a expressão: "${this.src.slice(this.pos)}".`,
        this.pos,
      );
    }
  }

  private peek(): string | undefined {
    return this.src[this.pos];
  }

  private advance() {
    this.pos++;
  }

  private skipWs() {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        this.pos++;
      } else {
        break;
      }
    }
  }
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || ch === "_";
}

function isIdentChar(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
