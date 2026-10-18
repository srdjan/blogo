// Per-module AST metrics: LOC, branches, max cyclomatic complexity, imports, fan-in.
import ts from "typescript";

// Usage: deno task metrics [file ...]. With no arguments, measure src/.

async function collectSourceFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      found.push(...await collectSourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found.sort();
}

const files = Deno.args.length > 0
  ? Deno.args
  : await collectSourceFiles("src");
const SK = ts.SyntaxKind;

const isFn = (n: ts.Node): boolean =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const branchOf = (n: ts.Node): number => {
  switch (n.kind) {
    case SK.IfStatement:
    case SK.ConditionalExpression:
    case SK.CaseClause:
    case SK.ForStatement:
    case SK.ForInStatement:
    case SK.ForOfStatement:
    case SK.WhileStatement:
    case SK.DoStatement:
    case SK.CatchClause:
      return 1;
    case SK.BinaryExpression: {
      const op = (n as ts.BinaryExpression).operatorToken.kind;
      return op === SK.AmpersandAmpersandToken || op === SK.BarBarToken ||
          op === SK.QuestionQuestionToken
        ? 1
        : 0;
    }
    default:
      if (
        (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) ||
          ts.isCallExpression(n)) && n.questionDotToken
      ) return 1;
      if (
        ts.isReturnStatement(n) && n.parent && ts.isBlock(n.parent) &&
        n.parent.parent && ts.isIfStatement(n.parent.parent)
      ) return 1;
      if (ts.isReturnStatement(n) && n.parent && ts.isIfStatement(n.parent)) {
        return 1;
      }
      return 0;
  }
};

type Row = {
  readonly f: string;
  readonly loc: number;
  readonly branches: number;
  readonly maxCc: number;
  readonly fnCount: number;
  readonly imports: readonly string[];
};

const rows: Row[] = [];
for (const f of files) {
  const text = await Deno.readTextFile(f);
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  let branches = 0;
  let maxCc = 0;
  let fnCount = 0;
  const imports: string[] = [];
  const visitFn = (fn: ts.Node) => {
    let cc = 1;
    const walk = (n: ts.Node) => {
      if (n !== fn && isFn(n)) return;
      cc += branchOf(n);
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(fn, walk);
    maxCc = Math.max(maxCc, cc);
  };
  const walk = (n: ts.Node) => {
    branches += branchOf(n);
    if (isFn(n)) {
      fnCount++;
      visitFn(n);
    }
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      imports.push(n.moduleSpecifier.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  const loc = text.split("\n").filter((l) =>
    l.trim() && !l.trim().startsWith("//")
  ).length;
  rows.push({ f, loc, branches, maxCc, fnCount, imports });
}
const fanIn = new Map<string, number>();
for (const r of rows) {
  for (const i of r.imports) {
    if (!i.startsWith(".")) continue;
    const dir = r.f.split("/").slice(0, -1).join("/");
    const target = new URL(i, `file:///${dir}/`).pathname.slice(1);
    fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
  }
}
console.log("file\tloc\tbranches\tmaxCC\tfns\timportsOut\tfanIn");
for (const r of rows) {
  console.log(
    [
      r.f,
      r.loc,
      r.branches,
      r.maxCc,
      r.fnCount,
      r.imports.length,
      fanIn.get(r.f) ?? 0,
    ].join("\t"),
  );
}
const totalLoc = rows.reduce((sum, r) => sum + r.loc, 0);
const totalBranches = rows.reduce((sum, r) => sum + r.branches, 0);
console.log(`TOTAL loc=${totalLoc} branches=${totalBranches}`);
