---
title: "Writing a Compiler in Zig: A Practical Engineering Guide"
date: 2025-12-17
tags: [Zig, C, Programming]
excerpt: A Guide to build a compiler in Zig.
---

Building a compiler in Zig involves leveraging the language's low-level control, explicit memory management, and robust standard library to implement each compilation phase efficiently. This guide walks through all core phases – lexing, parsing, intermediate representation (IR) construction, semantic analysis, optimization, and code generation – using a minimal JavaScript-like language (a subset of JS without object-oriented features) as the running example. We focus on practical Zig patterns and best practices rather than theory, highlighting idiomatic Zig techniques, memory management strategies, and error-handling approaches. We'll also draw on lessons from Zig's own compiler and notable Zig-based language projects.

## Compiler Architecture and Project Structure

Before diving into phases, it's important to outline a clean architecture. In Zig, it's common to organize each compiler phase into its own module for clarity and reuse. For example, one might have `scanner.zig` (lexical analyzer), `parser.zig`, `ast.zig` (definitions of AST nodes), `sema.zig` (semantic checks and symbol table logic), `ir.zig` (IR structures and optimization passes), and `codegen.zig` for back-end output. A `main.zig` can tie these together (or a library file exposing a `compileSource()` function). This separation enforces modularity – e.g. the parser module shouldn't need to know about target machine code details, and the code generator shouldn't worry about parsing text.

Each phase often needs memory allocation. Zig has no hidden garbage collector, so you explicitly manage memory via allocators. A common Zig idiom is to pass an `Allocator` to functions that need to create data structures (AST nodes, IR, etc.)[1][2]. In a compiler, a good strategy is to use an arena (bump) allocator for AST and IR nodes, since they are numerous and live until compilation ends. Zig's standard library offers `std.heap.ArenaAllocator` for this purpose. By allocating all nodes out of a single arena, you can free them all at once when compilation is done, avoiding complex per-node deallocation logic. For example, in your main you might initialize a `GeneralPurposeAllocator` or Arena and pass it into the compile pipeline[3]. If the compiler is long-running (e.g. part of a language server), you'd reset or reuse the arena between compilations.

Another architectural consideration is data representation. Zig's compiler takes a data-oriented design: instead of naive pointer-linked trees, it stores compiler data in contiguous arrays for cache efficiency. In fact, Zig's AST nodes, tokens, and IR use a Structure of Arrays layout via `MultiArrayList` to improve memory locality and reduce alignment padding[4][5]. This approach splits struct fields into parallel arrays. It requires more indirection in code, but yields better performance for large codebases. Adopting `MultiArrayList` is an advanced optimization; for a small language, a simpler approach (like an array of pointers or a tagged union of node types) might suffice, but it's worth knowing the pattern that Zig uses internally for scaling up.

Error handling and reporting is another cross-cutting aspect of compiler structure. Zig's error system (error unions and try/catch) is well-suited for propagating failures, but in a compiler you often want to recover and report multiple errors instead of aborting on the first. A common practice is to accumulate errors in a list during parsing and analysis. Zig's parser does exactly this – it maintains an errors list and continues parsing after encountering an error, whenever possible[6]. Each error might include a message and source location (which you can get from tokens or AST node indices). By the end, the compiler can report all errors at once. We'll see how to implement such error accumulation in the parsing phase. For critical failures (e.g. out-of-memory, or an unrecoverable internal inconsistency), you can still use Zig's error returns to unwind. In summary, design your compiler modules such that they clearly separate concerns, pass along context (like allocators and error lists), and favor collecting errors over immediate panics for a better user experience.

## Lexical Analysis (Scanning) in Zig

Lexical analysis (tokenization) is the first phase: converting raw source text (a series of bytes/characters) into a sequence of tokens (identifiers, keywords, literals, symbols). Zig is well-equipped for writing fast, low-level lexers. A guiding principle is to avoid unnecessary allocations and indirection in the scanner. Zig's own tokenizer exemplifies this: it operates on a slice of bytes and produces tokens without any heap allocation[7][8]. We can follow similar practices for our JavaScript-like language.

**Input representation:** Read the entire source file into a `[]const u8` byte slice. The Zig standard library can read a file into memory easily (e.g. `std.fs.readFileAlloc` using an allocator). Zig's tokenizer requires the input slice to be null-terminated (`:0` slice) so it can safely advance with sentinel termination[9]. We can ensure this by appending a 0 byte after reading, or by reading as `[:0]const u8` if using Zig's tokenizer API. A null terminator lets us check for end-of-file by looking for 0 rather than continuously bounds-checking the index[9].

**Token representation:** Define an enum for token types (e.g. `.Identifier`, `.Number`, `.Keyword_if`, `.Plus`, etc.) and a token struct holding the type and location info. Zig's `std.zig.Token` stores a tag (the token type) and a `Loc` struct with start and end indices into the source[10][11]. Storing just indices is memory-efficient: the token doesn't own the lexeme text, it just refers to the original source substring. This avoids allocating new strings for each token; if later needed (say for error messages), you can slice the original source with those indices[12]. We will do the same: our `Token` can have `type`, `start`, `end`, and maybe a `line` number for user-friendly errors.

**The scanning loop:** A Zig lexer is typically implemented as a state machine using a loop and switch on the current character. The Zig standard tokenizer uses nested while loops and switch statements to handle states[13]. We can structure our `nextToken()` function similarly:

```zig
const TokenType = enum { Identifier, Number, Plus, Minus, LParen, RParen, Eof, /*...*/ };

const Token = struct {
    typ: TokenType,
    start: usize,
    end: usize,
    line: usize
};

fn nextToken(scanner: *Scanner) Token {
    while (true) : (scanner.index += 1) { // advance index each iteration
        const c: u8 = scanner.buffer[scanner.index];
        switch (c) {
            // Skip whitespace
            ' ' => continue,
            '\t' => continue,
            '\n' => { scanner.line += 1; continue; },

            // Single-character tokens
            '+' => return .{ .typ = .Plus, .start = scanner.index, .end = scanner.index + 1, .line = scanner.line },
            '-' => return .{ .typ = .Minus, .start = scanner.index, .end = scanner.index + 1, .line = scanner.line },
            '(' => return .{ .typ = .LParen, .start = scanner.index, .end = scanner.index + 1, .line = scanner.line },
            ')' => return .{ .typ = .RParen, .start = scanner.index, .end = scanner.index + 1, .line = scanner.line },

            // Identifier or keyword (starts with letter or _)
            'A'...'Z', 'a'...'z', '_' => {
                return scanIdentifierOrKeyword(scanner);
            },

            // Number literal (starts with digit)
            '0'...'9' => {
                return scanNumberLiteral(scanner);
            },

            // End of input (null terminator sentinel)
            '\x00' => {
                return .{ .typ = .Eof, .start = scanner.index, .end = scanner.index, .line = scanner.line };
            },

            else => {
                // Unknown character – produce an error token or skip
                // We could accumulate an error here and continue scanning
                return .{ .typ = .Eof, .start = scanner.index, .end = scanner.index, .line = scanner.line }; // placeholder
            },
        } // end switch
    } // end while
}
```

In this pseudo-Zig code, we increment `scanner.index` each loop and examine one character at a time. Zig's switch can directly match character ranges (e.g. `'0'...'9'`) and multiple literals in one case[14], which keeps the code clean. We handle whitespace by continuing the loop without returning a token. When we recognize a token (like a `+` or `(`), we return a `Token` with appropriate type and positions. For multi-byte tokens like identifiers or numbers, we delegate to helper functions `scanIdentifierOrKeyword` and `scanNumberLiteral` that will consume the rest of the identifier/number and return a complete token.

**Implementing helpers:** The `scanIdentifierOrKeyword(scanner)` would start from the current `scanner.index` (pointing at the first letter), then advance while the characters are alphanumeric or underscore. It would then extract the substring (or just record the end index) and determine if the lexeme matches any language keyword (`if`, `while`, etc.). An idiomatic Zig trick for keyword recognition is to use an enum of keywords and Zig's compile-time reflection to convert strings to enum tags[15]. For example, one could define:

```zig
const Keyword = enum { If, Else, While, Return, _ }; // '_' as last variant for "not a keyword"

fn keywordFromSlice(slice: []const u8) Keyword {
    return std.meta.stringToEnum(Keyword, slice) orelse ._;
}
```

If `stringToEnum` succeeds, it gives the corresponding enum tag, otherwise we get `._` indicating no match (identifier is not a keyword). This saves writing a chain of string comparisons for each keyword. The scanner can then return either a `.Keyword_if` token type or a generic `.Identifier` token based on this result.

Numbers would be scanned similarly: consume digits, perhaps support a dot for decimals if needed. Since our example language is a simple subset, we can assume only integer literals for brevity. We'd record the numeric string's bounds, and we might convert it to an actual integer value later in parsing or evaluation.

**A key performance point:** the scanner above uses a simple loop per token, which is usually fast enough (and clarity is more important for a teaching example). For large inputs or maximum throughput, Zig lets you employ more exotic techniques. For instance, one can use SIMD instructions to scan multiple bytes at once, which Zig supports via portable SIMD types. Indeed, Zig community members have experimented with SIMD-accelerated lexers for Zig's compiler[16], scanning 32 bytes at a time to identify identifier characters. Those micro-optimizations can yield extremely high tokenization speeds (on the order of millions of lines per second), but they add complexity. In most cases, the straightforward approach with a tight loop and switch is sufficient and easier to maintain. And as one Hacker News user noted, parsing (and lexing) often isn't the top bottleneck in compilers – even a simplistic parser can handle ~500k–1M lines/sec, so other phases may dominate CPU time[17]. Nonetheless, Zig's low-level control and features like `@vectorize` make it possible to push performance boundaries in lexing if needed.

**In summary,** best practices for lexing in Zig are: operate on a byte slice (avoid I/O in the hot loop), use sentinel termination or explicit bounds checks to detect EOF, do not heap-allocate per token (just store indices or pointers into the input), utilize Zig's powerful switch for clarity, and handle simple cases (whitespace, single-char tokens) directly in the main loop while delegating more complex sequences to helper functions. With our scanner, we would get a list (array) of tokens ready for the next phase.

## Parsing (Syntax Analysis) in Zig

Parsing transforms the token stream into an Abstract Syntax Tree (AST) that represents the grammatical structure of the program. For our mini-JS, the grammar might include constructs like expressions, statements (`if`, `while`, etc.), function definitions, and so on, excluding object-oriented features. We'll implement a recursive descent parser, which is a straightforward and common technique given Zig's lack of built-in parser generators. Recursive descent fits Zig's philosophy of explicit control flow and can be written in a clear, idiomatic style.

### AST Node Definitions

First, we decide how to represent nodes of the syntax tree. A simple way in Zig is to use a tagged union or an enum+structs. For example, we can define an enum of node types and a union carrying data for each type:

```zig
const NodeType = enum { NumberLiteral, BinaryExpr, VarDecl, VarRef, FuncDecl, IfStmt, Block, /* ... */ };

const Node = union(NodeType) {
    NumberLiteral: i64,                             // literal value
    BinaryExpr: struct { left: NodeIndex, op: TokenType, right: NodeIndex },
    VarDecl: struct { name: []const u8, init: NodeIndex },
    VarRef: struct { name: []const u8 },
    FuncDecl: struct { name: []const u8, params: []NodeIndex, body: NodeIndex },
    IfStmt: struct { condition: NodeIndex, thenBranch: NodeIndex, elseBranch: ?NodeIndex },
    Block: []NodeIndex,
    // ... etc.
};
```

Here `NodeIndex` could be defined as a type (e.g. `u32` or pointer) used to reference other nodes. This design lets us store an AST node that can be one of several forms, each with appropriate fields. We could alternatively use separate structs for each node type and use pointers or inheritance-like patterns, but Zig's union-of-structs approach keeps everything in one type, simplifying memory management (we could allocate a chunk of memory for any `Node`).

Zig's own compiler, as mentioned, doesn't use a naive tagged-union AST; it uses the `Node` struct with generic `lhs` and `rhs` indices plus an external `extra_data` list for node-specific fields[18][19]. For example, a Zig AST node of type `.fn_decl` stores the index of a separate `.fn_proto` node in its `lhs`, and the index of a block node in its `rhs`. The function prototype node in turn uses one of its index fields to point into an `extra_data` array that holds a sequence of fields like parameter list start/end, calling convention, etc.[20][21]. This design packs all AST data into a few parallel arrays for efficiency. It's clever but can be confusing to implement from scratch. For our guide, we'll stick to simpler AST structures (like the union above or a tree of pointers) since our language is minimal. Just be aware that the optimal Zig implementation at large scale might lean toward such data-oriented patterns for memory/cache efficiency – e.g., Zig's AST uses ~37% less memory than a naive struct-of-structs approach due to eliminating padding and storing bools and other fields densely[22][23].

### Recursive Descent Parsing

We write a set of functions, usually one per grammar rule. For example, we might have `parseExpression`, `parseTerm`, `parseFactor` for expressions (if implementing operator precedence), as well as `parseStatement`, `parseBlock`, `parseFunction`, etc., for larger constructs. Each function consumes tokens (via an index into the token list) and produces either an AST node or an error.

A skeleton for expression grammar could be:

```zig
// Assume we have an array `tokens` and an index `cur` in a Parser struct

fn parseExpression(p: *Parser) !NodeIndex {
    return parseEquality(p);
}

fn parseEquality(p: *Parser) !NodeIndex {
    var node_index = try parseComparison(p);
    while (p.matchToken(.EqEq) or p.matchToken(.NotEq)) { // hypothetical == or != tokens
        const op = p.previous(); // the operator token we just matched
        const right = try parseComparison(p);
        node_index = p.addNode(Node{ .BinaryExpr = .{ .left = node_index, .op = op.typ, .right = right } });
    }
    return node_index;
}

fn parseComparison(p: *Parser) !NodeIndex {
    /* similar structure, calling parseTerm etc. */
}
```

In this pseudo-code, `p.matchToken(.EqEq)` would check if the current token is an `==` operator and advance the token index if so. The parser uses a `cur` index to track the current lookahead. Functions like `matchToken()` can simplify checking and consuming expected tokens. We create a new AST node for each binary operator sequence, making the left node the previously parsed subexpression and the right node the newly parsed one, building a left-associative tree. The `p.addNode(...)` would allocate or construct a `Node` (possibly in an `ArrayList` of nodes) and return an index or pointer to it.

Zig's parser follows a similar top-down approach but on top of its `MultiArrayList`. It has a `Parser` struct containing the token list and an index (`tok_i`), and methods for consuming tokens and constructing nodes in its nodes list[24][25]. One notable pattern is how it handles function prototypes, as discussed: rather than embedding all function components directly in one node struct, Zig's parser stores many pieces in `extra_data` arrays for flexibility[19]. For our simpler needs, we won't replicate that complexity.

### Parsing Statements and Blocks

We would implement functions like `parseStatement()` that dispatch based on token type. For example:

```zig
fn parseStatement(p: *Parser) !NodeIndex {
    const tkn = p.current();
    switch (tkn.tag) {
        .Keyword_if => return parseIfStatement(p),
        .Keyword_while => return parseWhileStatement(p),
        .Keyword_return => return parseReturnStatement(p),
        .LBrace => return parseBlock(p),
        else => return parseExpressionStatement(p), // e.g., an expression terminated by semicolon
    }
}
```

Each of those (`parseIfStatement`, etc.) would consume the necessary tokens (e.g., `if` keyword, then `(`, an expression, `)`, then a statement for the body, and optionally an `else` and another statement), constructing an AST node representing the control flow. The parser needs to enforce the grammar rules: if an expected token is missing, this is a syntax error. Error handling in parsing can be done in two ways:

**Fail-fast with error union:** Each parse function can return an `error.ParseError` if something unexpected happens (like encountering `}` when expecting an expression). This is simple to code with Zig's error system. However, if we stop at first error, we might not report subsequent errors.

**Error recovery:** More user-friendly compilers attempt to resynchronize and continue after an error. For example, on a parse error, you might skip tokens until a likely statement boundary (semicolon or brace) to resume parsing. Zig's parser collects errors in a list (`errors: ArrayListUnmanaged(AstError)`) and attempts to keep going[26][6]. We can implement a basic form of this: create an `errors: []AstError` array in our Parser, and when a parse function hits a syntax issue, append an error (with location and message) to the list, then skip some tokens to a known safe point (e.g., the next `;` or `}`) before returning some sort of error node or null node index. The rest of the parser will ignore that node but overall parsing continues.

For simplicity, our demonstration might use the error union approach for critical errors, but one could enrich it with recovery. For instance:

```zig
if (!p.matchToken(.LParen)) {
    p.addError("expected '(' after if", tkn.loc);
    // attempt recovery: no advancing here or maybe skip until next '{'
}
// ... continue parsing condition and body
```

Using Zig's error union is still useful for fatal conditions (like memory allocation failures). One strategy is to use error unions for "hard" errors (where continuing isn't feasible) but use the internal error list for syntax issues. Ultimately, whichever method is chosen, the goal is to accumulate parse errors rather than aborting immediately, to provide the programmer a list of issues in one compile run.

### Best Practices for Parsing in Zig

Use clear, small functions for each grammar rule. Embrace Zig's control flow – `if`, `while`, and `switch` – rather than trying to be overly clever or writing a code generator. The recursive descent style is imperative and fits Zig nicely. You can even use labeled blocks with `break :label { ... }` if you need to break out of nested structures on error. Zig does not (as of now) have language features like pattern matching on sequence of tokens or parser combinators in the standard lib, but the code you write is straightforward and all compiler logic is explicit, which experienced compiler authors often prefer for maintainability.

For managing the output AST nodes, you might store them in an `ArrayList` or your own arena. Zig's parser, for performance, allocates all AST nodes out of a single `GeneralPurposeAllocator` up front via the `MultiArrayList` (which itself manages resizing)[27]. In our case, using an `ArrayList(Node)` is fine; it will resize as needed and we can get indices to refer to nodes. Another approach is to allocate nodes one by one via an arena and use pointers instead of indices to link them – but then careful with pointer validity if you reallocate memory. An `ArrayList` is simpler because it owns a contiguous buffer that may move on reallocation, but indices (or pointers stable via arena) abstract that away. If using indices, make sure to use types (like `u32`) with a known max (perhaps limit the AST node count) or a dynamic size type. Zig's `NodeIndex` is a `u32`[28][29], meaning they assume the AST won't exceed 2^32 nodes in one file (which is reasonable).

As the parser runs, it builds the AST corresponding to the entire program. After parsing, we should have a root AST node (for JS, often a list of statements or a Module node containing all top-level statements and function declarations). Now we can proceed to the next phases: building an IR (if we choose to have one) and analyzing the semantics.

## Semantic Analysis and Symbol Table

Semantic analysis is the phase where we inspect and enrich the AST with meaning and catch any semantic errors (beyond just malformed syntax). In a statically-typed language, this is where type checking happens. In our JavaScript subset (which is dynamically typed), semantic analysis would be lighter – mainly handling variable scopes, function symbol resolution, perhaps constant folding, and preparing for code generation. Nonetheless, it's important to manage symbols (like variables and functions) even for dynamic languages: we need to ensure variable declarations exist, handle closures, etc.

### Symbol Table

A common structure for semantic analysis is a symbol table (or multiple tables representing nested scopes). In Zig, we might represent a symbol table as a hash map from identifier names to some info struct (like what kind of entity it is and perhaps an index to its AST node or its type). Zig's standard library provides `std.StringHashMap` or `std.AutoHashMap` which we can use for this[1] (Zig strings can serve as keys with provided hash functions). Because Zig uses slices for strings, if we use them as keys, we should ensure they have a lifetime covering the analysis – e.g., using the original source slice for identifiers (slicing it for each identifier's text) is possible but these slices are sub-slices of one big buffer, which is fine as long as the source text stays in memory. Alternatively, we can intern all identifier names: that is, store each unique identifier string in an intern pool (like a set or map) to get a canonical pointer or index for it. Zig's compiler does something akin to this for string literals and identifiers – it interns strings to avoid duplication[30][31], using hash maps cleverly to make string comparison O(1) (pointer equality) after interning. We could implement a simple string intern: maintain a global `HashMap<[]const u8, []const u8>` where the value is a stable allocated copy of the key (allocated once per unique string). Then for each identifier token, look it up; if not present, allocate and insert it. The returned pointer (or slice) is then guaranteed unique per distinct lexeme. This saves memory if many occurrences of the same identifier exist and speeds up comparisons (we can compare pointers or lengths first, etc.). However, for a small compiler, this might be overkill – using the token's slice of the source as the identifier name could suffice.

### Scope Management

As we traverse the AST in this phase, we maintain a stack of scopes. Each scope can be represented by a symbol table mapping names to their definition nodes or other metadata. For example:

- Start with a global scope (for top-level declarations).
- On entering a function definition, push a new scope for its parameters and local variables.
- On entering a block (if your language has block scoping, like JS `let` or `const` – but classic `var` in JS is function-scoped, which simplifies our subset), you might push a new scope if needed.
- On exiting, pop the scope.

For each variable declaration node (`VarDecl`), we check the current scope to ensure the name isn't already defined (unless shadowing is allowed). If it's unique, we insert it into the table. If it conflicts, that's a semantic error ("variable already defined"). For each variable reference (`VarRef` node), we resolve it by looking in the innermost scope then outward (lexical scoping). If not found, that's an error ("undefined variable"). We can annotate the `VarRef` node with a pointer or index to the symbol's declaration if needed (for later stages like codegen).

### Type Checking

If our language had types, we'd propagate types through expressions here. In dynamic JS subset, we don't enforce types at compile time; all values are dynamic. But we might still need to handle certain implicit semantics – e.g., check that a `return` statement is inside a function, not at global scope (or conversely, that every function ends with a return or implicitly returns undefined).

### Constant Evaluation

One useful analysis/optimization at this stage is constant folding. We can walk the AST and evaluate constant expressions. For example, if we have a `BinaryExpr` of two `NumberLiterals`, we can compute the result and replace the node with a single `NumberLiteral` node of the result value. Zig's compile-time execution (`comptime`) isn't directly applicable to running user program code (since that code is only known at runtime), but we can easily write a Zig function to evaluate an AST expression node if it's composed of known literals and pure operators. This can be done in the AST itself or by constructing an IR and doing it there; we'll discuss it shortly. Zig's strong typing and ability to use big integers at comptime (for arbitrary precision, if needed) could help if our language had arbitrary large number literals, but standard 64-bit is fine here.

### Using Zig for Analysis

Zig doesn't have reflection or annotations as a high-level language like Java for AST, but because we wrote the AST data structures ourselves, we simply traverse them. This is typically done with either recursion or an explicit stack. For example, to resolve all `VarRef`:

```zig
fn resolveNames(nodeIndex: NodeIndex, scope: *Scope) void {
    const node = ast[nodeIndex];
    switch (node) {
        .VarRef => {
            if (!scope.resolve(node.VarRef.name)) |sym| {
                addSemanticError("Undeclared variable", node.VarRef.name, node.location);
            } else {
                // link the VarRef to sym (maybe store sym.id in VarRef for codegen)
            }
        },
        .VarDecl => {
            const name = node.VarDecl.name;
            if (scope.isDefined(name)) {
                addSemanticError("Variable redeclared", name, node.location);
            } else {
                scope.put(name, nodeIndex);
            }
            if (node.VarDecl.init) |initIndex| {
                resolveNames(initIndex, scope);
            }
        },
        .Block => |blockNodes| {
            scope.push(); defer scope.pop();
            for (blockNodes) |stmtIndex| {
                resolveNames(stmtIndex, scope);
            }
        },
        .FuncDecl => {
            const funcName = node.FuncDecl.name;
            if (scope.isDefined(funcName)) {
                addSemanticError("Function redeclared", funcName, node.location);
            } else {
                scope.put(funcName, nodeIndex);
            }
            // new scope for function params and body
            scope.push(); defer scope.pop();
            for (node.FuncDecl.params) |paramIndex| {
                const paramName = ast[paramIndex].VarDecl.name;
                if (scope.isDefined(paramName))
                    addSemanticError("Duplicate parameter", paramName, ast[paramIndex].location);
                else
                    scope.put(paramName, paramIndex);
            }
            resolveNames(node.FuncDecl.body, scope);
        },
        .IfStmt => {
            resolveNames(node.IfStmt.condition, scope);
            resolveNames(node.IfStmt.thenBranch, scope);
            if (node.IfStmt.elseBranch) |elseIndex| {
                resolveNames(elseIndex, scope);
            }
        },
        // ... handle other node types (While, etc.)
        else => {
            // Expressions like BinaryExpr
            if (node.getType() == .BinaryExpr) {
                resolveNames(node.BinaryExpr.left, scope);
                resolveNames(node.BinaryExpr.right, scope);
            }
            // handle other expression nodes similarly
        }
    }
}
```

This pseudocode uses a `Scope` object that provides `push()`/`pop()` and `resolve`/`put` methods for symbol management. We traverse the AST, checking and populating as we go. (In practice, we'd likely integrate this with type checking or IR generation to avoid multiple full tree walks, but one pass for name resolution is fine.)

As we do this, we accumulate semantic errors using `addSemanticError`. This could add to the same error list used by the parser or a separate one. Each error includes a message, possibly the name or value in question, and a source location (which we can get if our AST nodes carry a token reference or start/end indices). Zig's careful tracking of token start/end means we can map an AST node back to a portion of source code easily[12]. For user diagnostics, one might use `std.fmt` to format an error string and even print a snippet of the source with a caret. The details of error reporting formatting are beyond our scope here, but Zig's `std.debug.print` or `std.log.err` can be used to print errors with some context.

### Intermediate Representation (IR)

After semantic analysis, many compilers translate the AST into a lower-level IR for optimization and codegen. For our language, we have options:

- We could skip a custom IR and generate code directly from the AST (given dynamic types, there's not a lot of type-driven optimization to do).
- Or we could define a simple IR, for example a list of three-address code instructions or a stack-based bytecode.

Designing an IR in Zig can be done with enums or structs similar to AST. For example, a three-address code instruction set might be an enum like:

```zig
const Inst = union(enum) {
    ConstInt: struct { dest: Reg, value: i64 },
    Add: struct { dest: Reg, src1: Reg, src2: Reg },
    Load: struct { dest: Reg, varName: []const u8 },
    Store: struct { src: Reg, varName: []const u8 },
    Call: struct { funcName: []const u8, args: []Reg, ret: ?Reg },
    // ...
};
```

where `Reg` is some representation of a virtual register or stack slot. Alternatively, a stack-machine IR (like WebAssembly or JVM bytecode) could be even simpler (no explicit registers, just push/pop). For instance, instructions like `ICONST val`, `IADD`, `CALL func,nargs`, etc. could be enumerated.

Zig allows using packed enums or even plain integers for instruction opcodes, but using a tagged union `Inst` as above gives type safety (ensuring you only access fields relevant to that opcode).

If we choose to create an IR, we would traverse the AST after semantic checks and emit a sequence of `Inst` into a list. This is a typical AST lowering process. During this, we might perform some optimizations (the next section) on the fly or build a data flow graph for more complex optimizations.

However, given our small language, we might not need a very elaborate IR stage. Another path is to directly target a well-known IR like WebAssembly or LLVM IR – essentially treating that as our IR. We'll discuss that in Code Generation. But for learning purposes, let's assume we make a simple IR and perhaps optimize it slightly (constant fold etc.).

Before moving on, let's recap best practices for analysis in Zig: Use the opportunity of walking the AST to attach needed info (e.g., resolved symbol pointers, computed constant values) for later phases. Keep data structures local to this phase as needed (e.g., a `struct VarInfo { isUsed: bool, ... }` to track if a variable is ever used, to warn about unused variables or to optimize dead stores). Zig's explicit memory management means you should decide if these analysis structures live on the heap (use an allocator) or stack. For a small compiler, a lot can live in the stack or even as fields in the AST nodes (like adding an `Optional(value)` field for constant expressions). Zig's comptime could be used in interesting ways, e.g., to generate a perfect hash for keywords or unroll certain static checks, but typically the analysis is dynamic.

Finally, maintain the error list. By the end of semantic analysis, any undefined variables, duplicate definitions, etc. should have been caught and recorded as errors. If errors exist, you might choose to stop before codegen, or proceed but mark that the output shouldn't be executed.

## Optimization Strategies

Compiler optimizations take the IR (or AST) and transform it to improve performance or reduce size while preserving semantics. In Zig, you can implement many classic optimizations manually if needed. However, if you plan to use an external back-end like LLVM or rely on WebAssembly (which can be further optimized by tools), you might not need to write too many yourself. Still, we'll cover a few common ones and how to approach them in Zig.

### Constant Folding

We introduced this in semantic analysis. Whether done on AST or IR, it's one of the easiest wins. In Zig code, this might look like:

```zig
fn foldConstants(node: NodeIndex) NodeIndex {
    const n = ast[node];
    switch (n) {
        .BinaryExpr => {
            const left = foldConstants(n.BinaryExpr.left);
            const right = foldConstants(n.BinaryExpr.right);
            const op = n.BinaryExpr.op;
            if (ast[left].getType() == .NumberLiteral and ast[right].getType() == .NumberLiteral) {
                const a = ast[left].NumberLiteral;
                const b = ast[right].NumberLiteral;
                const result = switch (op) {
                    .Plus => a + b,
                    .Minus => a - b,
                    .Star => a * b,
                    .Slash => a / b,
                    else => return node, // not a numeric operator
                };
                return ast.addNode(Node{ .NumberLiteral = result });
            } else {
                // Replace children in current node in case they got folded
                ast[node].BinaryExpr.left = left;
                ast[node].BinaryExpr.right = right;
                return node;
            }
        },
        .IfStmt => {
            // constant fold condition
            const condIdx = foldConstants(n.IfStmt.condition);
            ast[node].IfStmt.condition = condIdx;
            // maybe eliminate dead branches:
            if (ast[condIdx].getType() == .NumberLiteral) {
                const val = ast[condIdx].NumberLiteral;
                if (val == 0 or val == false) { // treat 0 as false, any non-zero as true for simplicity
                    // replace entire if node with else branch (or remove if no else)
                } else {
                    // replace with then branch
                }
            }
            // Recurse into branches normally
            foldConstants(n.IfStmt.thenBranch);
            if (n.IfStmt.elseBranch) |e| {
                foldConstants(e);
            }
            return node;
        },
        else => {
            // for other node types, just recurse as needed
            return node;
        }
    }
}
```

This pseudo-code demonstrates constant propagation in expressions and even a simple dead-code elimination for if statements with constant conditions (a form of constant propagation and dead code elimination). In Zig, you can use native arithmetic for integers (taking care of overflow rules as needed) and even leverage big integers if you had arbitrary precision (Zig's `std.bignum` could help if needed, but not likely for our case). The code above checks if both sides of a binary expression turned into literals, and if so, computes the result and creates a new `NumberLiteral` node. We have to be mindful of freeing or discarding old nodes if we allocate new ones – since we might not want to leak memory. If using an arena that will be freed en masse later, it's less of a concern; the AST may have some garbage nodes that nothing references after folding, which is acceptable until the whole AST is freed.

### Dead Code Elimination (DCE)

On an IR level, one could remove instructions that compute values never used, or remove entire branches of code that are known to never execute. For a dynamic language, aggressive DCE is trickier (since even evaluating an expression could have side effects, you can't remove it just because its result isn't used). But in a small language without complex side effects (or if you identify pure computations), you could drop them. If we had an IR, we could analyze liveness of temporaries or track side-effect-free instructions.

### Inlining

A compiler might inline small functions at call sites to avoid call overhead. We could attempt it if we have an IR – scanning for calls of known functions and replacing them with the function's body IR. In Zig, implementing inlining means managing variable renaming (to avoid collisions of variables from the callee in the caller's scope) or using a separate name space for function-local registers. It's a non-trivial but doable optimization.

### Loop Optimizations

Given our example subset, we might have `while` loops. Classic optimizations like loop-invariant code motion or strength reduction could be implemented by analyzing the IR inside loops. These are complex to demonstrate here, but Zig's control over memory means you can implement graph algorithms or data-flow analyses fairly directly with pointers and slices. For instance, you could build a control-flow graph (CFG) of basic blocks by representing each block as a struct with an Array of instructions and successors, then perform analyses on that graph.

In practice, many Zig-based compilers keep optimization passes limited if they intend to hand off to an optimizing backend (like LLVM or the Zig backend). For example, Aro (the Zig-written C compiler) likely performs minimal AST-level optimization and relies on Zig's backend for heavy lifting[32]. If using WebAssembly, one might rely on the WASM engines or a post-processing tool (like wasm-opt from Binaryen) for optimization.

**To sum up for optimizations:** pick low-hanging fruit that are easy to implement and give clear wins (constant folding, simple DCE), and defer complex optimizations unless absolutely needed. Zig's strengths here are its speed (you can afford some extra passes in Zig because it's fast and no GC to pause you) and explicitness (it's easier to reason about what your code is doing, which helps avoid mis-optimizing). Additionally, Zig's ability to call C code could let you incorporate existing optimization libraries if desired, though that's uncommon.

## Code Generation (Targeting WebAssembly, LLVM, or Native Code)

The final phase is turning our IR or AST into executable code. There are multiple routes here, each with different trade-offs in a Zig context. We'll explore the common ones: generating WebAssembly, emitting LLVM IR, integrating a JIT, or even using Zig's own compiler back-end. We'll also mention the simple route of an interpreter as an alternative.

### Emitting WebAssembly

WebAssembly (WASM) is an attractive target for a small language: it's a portable binary format with a well-defined specification and can be executed in browsers or via standalone runtimes. Zig can easily produce WebAssembly output for Zig code, and supports WASI (WebAssembly System Interface) in its std library[33]. For our compiler, we would manually generate a WASM module corresponding to the input program.

There are two ways to generate WASM:

- **Text format (WAT):** Generate a `.wat` text representation and then assemble it to wasm bytes. This is human-readable and easier to debug. However, you'd need to invoke an assembler (like `wat2wasm`) or include a WASM assembling library.
- **Binary format directly:** Write the WASM binary format (`.wasm`) bytes. The WASM spec defines a binary encoding for instructions, section headers, etc. This requires careful adherence to the format (emitting section lengths, indices for functions and locals, etc.).

In Zig, writing binary data is straightforward using `std.io` Writer or just appending to a `std.ArrayList(u8)`. You'd construct the WASM header and sections. For example, you'd emit the magic `\0asm` and version, then a type section (function signatures), function section (indexes of functions using those signatures), a code section (the actual function bodies), etc. Each function body would contain local variable declarations and the bytecode for the function.

Our example language could be mapped to WASM relatively naturally: numbers map to WASM `i32` or `f64` (depending on what we choose; JS numbers are doubles, but we could simplify to 32-bit int for demonstration). Variables become WASM locals or get mapped to an environment structure if needed for closures (but if no closures or if we handle them differently, each function's locals are fine). Control structures like `if` and `while` map to WASM `if` and `loop` constructs. Function calls map to WASM calls.

For instance, if we had a simple function:

```javascript
function add(a, b) { return a + b; }
```

In WASM text it might look like:

```wat
(func $add (param $a i32) (param $b i32) (result i32)
  local.get $a
  local.get $b
  i32.add
  return
)
```

We would generate something equivalent from our AST. A slightly tricky part is managing block indices for control flow (WASM uses structured control flow, so you emit `block` and `loop` and use `br` for jumps). But for while loops, a common pattern is:

```wat
(block $exit
  (loop $loop
     ;; evaluate condition
     i32.eqz
     br_if $exit    ;; if condition is false, break to exit
     ;; loop body
     br $loop       ;; jump back to start of loop
  )
)
```

Our compiler would need to output such a pattern for a while-loop AST node. This involves generating labels and relative jump indices. It's certainly doable in Zig: you might give each loop a label index and keep track of them in a stack while generating to handle nested loops and breaks.

Since implementing a full WASM emitter is a sizeable task, one could simplify by targeting WASI and generating a small Zig or C runtime to call into. But let's keep it self-contained: Zig can handle writing the WASM file directly.

Notably, there are Zig community projects around WebAssembly (e.g., zware – a Zig WebAssembly runtime engine[34], or zigwasm/wasm-zig for WASM binding[35]). Those are more about running WASM or interfacing with it rather than generating it. For generation, you might find it sufficient to implement it manually or perhaps use a library if one exists. At the time of writing, a concise Zig library for WASM code generation isn't widely known, so manual seems the way.

### Using LLVM via Zig

LLVM is a proven backend for generating optimized machine code. Zig's own compiler (stage1) leverages LLVM to generate binaries for many targets. In Zig, you can call C functions and even compile C code in the Zig build, so linking against LLVM's C API is possible. This means you could write Zig code to:

- Construct an LLVM module (`LLVMModuleRef`),
- Add function prototypes and definitions,
- Emit IR builder calls for each instruction corresponding to your AST/IR,
- Run LLVM optimizations (like the standard O2 passes),
- And finally generate an object code or binary.

While powerful, using LLVM directly is quite complex and adds a huge dependency (the LLVM libraries). For a smaller project, this might be overkill. But it can be optimal if you want top-notch optimization and don't mind the dependency.

If one chooses this path, note that Zig can easily link to C functions (LLVM's C API) as Zig can compile C++ as well if needed. You would have to have LLVM installed or available for linking. You might also consider using Zig's own `std.zig.LLVM` integration if any exists – currently, Zig mainly uses LLVM internally rather than exposing it as a stable library for Zig programs. So the C API is the likely route.

The advantage is you offload code generation and a lot of optimization to LLVM. Your job becomes mapping your language's semantics onto LLVM IR constructs (creating IR for arithmetic, control flow, calls, etc., and mapping types appropriately). For example, our `add(a,b)` function could be created via LLVM APIs to add two 32-bit integers and return.

Given the complexity, many Zig projects avoid direct LLVM unless necessary. Instead, they sometimes generate C and use Zig to compile it (transpilation approach), which is simpler though less efficient. But it's worth noting: Zig was explicitly designed to be a good compiler infrastructure in some ways – it's a freestanding language with manual memory control and no runtime, which are desirable traits for writing compilers. But Zig the language does not (yet) provide a high-level framework to emit machine code easily (other than using its own backend internally). Thus, bringing in LLVM is reasonable for a production-quality JIT or native compiler in Zig, at the expense of complexity.

### Embedding a JIT or VM (e.g., using MIR)

Another approach is to avoid generating a static binary at all and instead JIT compile or interpret the code. The project Buzz (a Zig-based scripting language) takes this route: it uses the MIR (Medium Internal Representation) library to JIT compile code to machine code at runtime[36]. MIR is a lightweight C library that provides an IR and JIT backends for several architectures. A Zig compiler can call into MIR: essentially constructing MIR instructions corresponding to the user program, then asking MIR to emit machine code in memory and executing it. Buzz achieves high performance by doing this, and it saves the effort of writing a full code generator from scratch.

Using MIR or a similar library in Zig involves C interop. You'd include the MIR headers, perhaps via Zig's ability to compile C, and then call its functions. The trade-off is dependency on an external project, but MIR is quite small compared to LLVM. This approach is great for an interactive language or REPL where you want to quickly compile and run code on the fly (Buzz is JIT-compiled, meant to be used as an embedded scripting engine, so JIT makes sense).

Alternatively, one can implement a bytecode interpreter in Zig. This means instead of producing machine code or WASM, you compile the source to a custom bytecode and then run it on a VM loop written in Zig. This is often simpler than writing a full optimizing back-end. The cost is execution speed (interpreters are typically 5-10x slower than native code, but depending on the use-case that might be acceptable).

For example, Zua, a Lua 5.1 implementation in Zig, likely parses Lua and then interprets the Lua bytecode[37] (since Lua's standard interpreter is a bytecode VM). By writing an interpreter in Zig, you control the execution environment fully and can easily implement features like debugging or sandboxing. The interpreter approach means your "code generation" phase is just producing a sequence of bytecode instructions (very similar to our IR design), and then you feed that to a Zig function that loops over instructions using a big switch (or computed goto via function pointers) to simulate the CPU. Zig's performance, being C-like, can result in a fast interpreter (comparable to C interpreters of languages).

### Reuse Zig's Self-Hosted Backend

A unique possibility is to use Zig's own compiler backends to emit machine code for you. This is exactly what Aro, the Zig-written C compiler, does – it produces an IR and feeds it into Zig's back-end to get machine code[38]. The Zig self-hosted compiler (stage2) has backends for multiple architectures, and Aro's `aro_backend` module provides a language-agnostic IR that can be translated into those backends[32]. In theory, you could do something similar: translate your language to Zig's IR (ZIR/AIR) and then invoke Zig's codegen to output an object or binary. However, this approach is tightly coupled to Zig's compiler internals (which are not officially stable for external use yet). It's an advanced route and mainly of interest if you want to eventually integrate your language with Zig tooling. For instance, if you were adding a new frontend to Zig (like Aro does for C), that makes sense. But for a standalone project, it might be simpler to choose one of the aforementioned methods (WASM, LLVM, JIT, or interpretation).

### Code Generation Strategy Comparison

| Strategy | Pros | Cons | Best For |
|----------|------|------|----------|
| WebAssembly | Portable, sandboxed, web-ready | Manual binary format work | Web apps, sandboxed execution |
| LLVM | Excellent optimization, many targets | Large dependency, complex API | Production compilers needing speed |
| MIR JIT | Lightweight, fast compilation | External dependency | REPLs, scripting languages |
| Bytecode Interpreter | Simple to implement, debuggable | Slower execution | Learning, embedded scripting |
| Zig Backend | Reuses existing infrastructure | Unstable internals | Zig ecosystem integration |

In our context of a minimal JS subset, a reasonable choice is to output WebAssembly or to interpret the code. WebAssembly has the advantage that we can run the output in a web environment or easily sandbox it. If we output WASM, we could even use Zig to run that WASM (by invoking a WASM runtime in Zig) as a way to execute the code for the user, or simply deliver the WASM module as the compiled artifact.

For illustration, let's assume we implement a WASM code generator. We would create, for each function AST node, a sequence of WASM instructions. We'd allocate continuous indices for local variables (for simplicity, treat all variables as 32-bit integers in WASM). The symbol table from analysis can help here: each variable in a function can be assigned a WASM local index. For global variables (if any), we might treat them as WASM globals (with some index). If our language allows closures or capturing outer variables, we'd need to decide how to implement that – possibly by environment structs or by restricting ourselves (for now assume no closures or only global and local scopes).

We'd also generate a small runtime or prelude if needed. For example, if the language supports `print` or other built-ins, and we are targeting WASI, we might rely on WASI imports for I/O (like using the WASI-provided `fd_write` for output, or we could inject our own imported function for console output).

One of Zig's strengths in codegen is its ability to format binary data easily and control endianness, etc. You'd use `std.io.Writer.writeByte` or similar repeatedly to build the WASM file. You can also use `std.mem.writeIntLittle` to write integer values in little-endian to a byte array. For example:

```zig
try writer.writeAll(u32toBytesLe(constant)); // writes a 32-bit little-endian
```

where `u32toBytesLe` is something you can get via Zig's `std.mem` or by bit-casting.

Finally, after codegen, you have the target representation (be it machine code, WASM module, or bytecode) ready. The compiler can then output it to a file or memory. If it's an ahead-of-time compiler, you'll write an executable or module to disk. If it's an interpreter or JIT, you might directly run it or keep it in memory for execution.

## Memory Management in Zig's Compiler Context

Throughout these phases, we've touched on memory management, but let's consolidate the best practices:

**Use arena allocators for bulk allocations:** AST nodes, IR instructions, and other compiler data structures are ideal for arena allocation. They have simple lifetime (usually valid until compilation finishes). By using an arena or bump allocator, you allocate quickly and free everything in one go. This also mitigates fragmentation. Zig's `std.heap.ArenaAllocator` or an `std.heap.GeneralPurposeAllocator` with a monotonic behavior works well. Always free the arena at the end (or reuse it if doing multiple compiles in one session), and consider using tools like Zig's leak detection (`GeneralPurposeAllocator` can be configured to track leaks and report them on deinit)[3] to ensure you're not unintentionally forgetting to free memory that should be freed earlier.

**Avoid per-token or per-node heap allocations:** As we noted in lexing, don't allocate a fresh string for each token. In parsing, don't allocate a new list for every small grouping if you can reuse one. Zig's `ArrayList` and `MultiArrayList` help by batch allocating. If you need a dynamic array of something, prefer using one of those with a single allocator rather than calling `alloc()` in a loop. For example, instead of doing `node.children = alloc(Node, childCount)`, you might push children onto an `ArrayList` that grows its buffer exponentially and only allocates log(n) times.

**Manage object ownership clearly:** Decide which part of your compiler owns a piece of memory. Perhaps the Parser owns the AST nodes (via an allocator or list), the semantic analyzer might annotate nodes but not create new long-lived structures (or if it does, it uses the same allocator). The codegen might create new buffers for machine code or output – you might want to allocate those with a separate allocator or free them right after output. Zig makes you think about this, which is good for building a memory-efficient compiler.

**Memory layout optimizations:** If you need extreme performance, consider the data-oriented layouts like `MultiArrayList`[4]. This is more relevant when your compiler handles tens of thousands of nodes and memory access patterns matter. It's an optimization Zig's own compiler uses to reduce memory usage by 37.5% for AST nodes and improve cache hits[23]. The downside is more complex code (lots of indices and parallel arrays to manage). Often, you can start with a simpler representation and profile later – Zig will give you the tools (like its benchmarking and profiling support) to measure if AST processing is a hotspot.

### Memory Strategy Comparison

| Approach | Memory Usage | Performance | Complexity | Use When |
|----------|--------------|-------------|------------|----------|
| Arena Allocator | Good | Fast alloc, bulk free | Low | Most compiler phases |
| Per-node malloc | Poor | Slow, fragmentation | Low | Avoid |
| MultiArrayList | Excellent | Cache-friendly | High | Large-scale compilers |
| Stack allocation | Excellent | Fastest | Medium | Small, fixed-size data |

One should also manage temporary memory carefully. During parsing or analysis, you might need short-lived buffers (for, say, building a list of parameters or arguments). Zig provides `std.heap.PageAllocator` or stack allocation (with `var buf: [N]T` on the stack) for such cases. Often, you can allocate from the same arena and then rewind a pointer or free in bulk if you plan it.

The key is to avoid long-term fragmentation and leaks. Zig's requirement that every allocation has an associated free (or that you intentionally leak and rely on process end) forces you to be disciplined. In a long-running compiler process (like a daemon or language server), leaking is unacceptable, so arenas should be freed or reused after each compile. In a one-shot command-line compiler, you could theoretically let the OS reclaim memory on exit, but it's still good form to clean up, and Zig makes it easy to do so with `defer allocator.free(...)` or by the nature of arenas.

## Error Handling and Diagnostics

A robust compiler not only generates correct code but also provides helpful diagnostics. Zig's facilities for error handling, as well as its formatting and logging, can be leveraged for compiler diagnostics.

During parsing and semantic analysis, we maintained an errors list of our own error objects. Each error might contain:

- An error kind or code (e.g., "UnexpectedToken", "UndefinedVariable").
- A human-friendly message.
- A location (line and column, or a token index and length).

Because our tokens carry location (start/end indices and the line number)[12], we can convert an index to a line and column by counting newlines or using the recorded line info. We could also store a mapping from file offset to (line, col) during lexing for quick lookup.

Zig's `std.fmt` can be used to format error messages, and `std.log` can categorize them (as errors vs warnings, if we had warnings). We might have an error like:

```zig
const CompileError = struct {
    message: []const u8,
    line: usize,
    column: usize,
    source_line: []const u8, // the entire line of code where error occurred
};
```

We can fill this out and then later print:

```zig
std.debug.print("Error at {d}:{d}: {s}\n{s}\n{:_^*s}\n",
    .{ err.line, err.column, err.message, err.source_line, "", err.column, "^" });
```

This would print something like:

```
Error at 10:5: undefined variable 'x'
    total = x + y;
          ^
```

– showing the line and indicating the position. (The format above uses `{:_^*s}` trick to print a caret under the column by printing a string of underscores with length equal to column, then a caret.)

### Using Zig's Error Sets

We used our own error collection, but Zig also has error sets which can be part of function signatures. For example, `fn parsePrimary(p: *Parser) ParseError!NodeIndex` could be a function that returns either a `NodeIndex` or a `ParseError` (an error value). `ParseError` could be an error set like `error{UnexpectedToken, UnterminatedString}`. In practice, mixing Zig error handling with manual error lists can be tricky – if you `catch |err|` an error to handle it and continue, you might need to convert it to your error list. It's often simpler to use error sets for fatal conditions (where you genuinely abort the compilation), and use manual error tracking for recoverable conditions (to report multiple issues).

Zig's own compiler code uses error sets for things like I/O or system calls errors, and uses internal error lists for compile errors. Following that model is wise.

Another Zig-specific nicety is the ability to use `defer` for cleanup. For instance, if during codegen you open a file for writing the output, you can `defer file.close()`. Or if you allocate a big temporary buffer, you can `defer allocator.free(buf)`. This ensures resources are released even if an error is thrown in that scope. Writing a compiler involves many early returns on error; Zig's `defer` and `errdefer` help avoid resource leaks on those paths.

One more point: Zig allows testing code with `test` blocks. While not exactly error handling, you can write unit tests for pieces of your compiler (like a specific parse function) directly in the implementation file. This can greatly increase confidence that, say, your expression parser works as expected. In lieu of a full suite of integration tests, these are quick to set up.

## Case Studies: Zig in Compiler Projects

To ground our discussion, let's briefly look at some real-world projects using Zig for compilers or language runtimes, and what we can learn from them:

### Zig's Self-Hosted Compiler (stage2)

This is Zig, written in Zig. As we've cited, it demonstrates many optimal practices: a tokenizer that does zero allocations and works line-by-line[7], a parser that uses a data-driven design with `MultiArrayList` and accumulative error recovery[42][6], and multiple IR stages (ZIR, AIR) to perform semantic checks and optimizations[43]. One interesting aspect is how Zig's compiler uses separate IRs for different phases: after AST it produces ZIR (Zig IR) for type checking, then AIR (an analyzed IR) for optimizations and codegen[43]. This separation keeps passes simpler. It also heavily uses Zig's ability to execute code at compile-time (`comptime`) to implement compile-time functions and evaluations as part of the compilation – a feature unique to Zig's language needs. Studying Zig's compiler source (in `std/zig/`) is instructive, though it's a large codebase. Mitchell Hashimoto's series of articles[44] on Zig compiler internals (which we referenced) is a great starting point to understand these patterns.

### Aro (C compiler in Zig)

Aro is a C99 compiler written in Zig, aiming for fast compile times and low memory usage[45]. It's actually being integrated as Zig's alternative C frontend. Aro's approach uses a front-end in Zig to parse C and an IR (`aro_backend`) which is fed to Zig's backends[32]. This shows a modular design: the language-specific front-end is separate from the codegen, which is reused. Aro's focus on diagnostics and compatibility is high – for instance, producing good error messages for C code. It demonstrates that Zig can handle a complex grammar like C (which is not trivial to parse) efficiently. The open-source Aro repository is a valuable case study in implementing a traditional compiled language in Zig.

### Buzz (Lightweight scripting language)

Buzz is a small statically-typed scripting language implemented in Zig. It is interesting for using an external JIT (MIR)[36]. Buzz's pipeline: it parses source into an AST, does semantic checks (it has a static type system, so it does type inference and checking), then generates MIR IR rather than a custom backend. Using MIR, it can compile to machine code in-memory and execute, giving performance close to native. Buzz's author chose this to keep the language runtime lean (MIR is much smaller than linking all of LLVM). Buzz also supports fibers (cooperative threads)[46], which means its code generation and runtime have to handle yielding and resuming execution – likely implemented by generating code that checks for yield points or by managing execution contexts. It's a good example of integrating Zig with C libraries and of managing a runtime (the fiber system) in Zig.

### Zua (Lua interpreter in Zig)

Zua implements Lua 5.1 by essentially rewriting Lua's VM in Zig[37]. It likely reuses Lua's parser or writes a new one in Zig, then either interprets Lua bytecode with a Zig loop or possibly translates it to C calls. The project's goal is for learning, but it highlights Zig's suitability for writing interpreters: Lua has a register-based VM, and writing such a VM in Zig would be similar to doing it in C, but with better safety (Zig's type system and option types can reduce certain classes of errors). Zua shows how one can take a well-known language and implement it from scratch in Zig, which is a testament to Zig's general-purpose nature.

### Bog (Vexu's toy language)

The repository Vexu/toy-lang (also referenced as "bog") is a playground language by a Zig contributor. It's described as a small strongly-typed embeddable language[47]. While I won't dive into its code here, one can assume it experiments with various features. Given the author (Vexu) is also behind Aro, it likely employs some advanced techniques. Embeddable means it's designed to be used as a library – so its API likely exposes an interface to compile and execute code, possibly using an AST interpreter or some quick JIT. It could serve as an example of packaging a Zig compiler as a component.

### Bun (JavaScript runtime)

Bun isn't exactly a compiler front-end project – it's a JS runtime built in Zig that embeds JavaScriptCore (WebKit's JS engine) and adds a lot of tooling. However, it demonstrates Zig's capability to glue together complex systems and manage memory and threads safely for a language runtime. Bun uses Zig's async I/O and networking to create a fast environment for JS apps. While Bun delegates JavaScript parsing/JIT to JavaScriptCore (C++ code), Zig is used for everything around it, showing that Zig is reliable for long-running, heavy workloads (which a JS runtime certainly is). If one were to write a new JS engine in Zig, they'd have to implement a huge spec, but Bun shows you can integrate existing compiler components with Zig, thanks to its C-interop and cross-compilation ease.

### Lessons Learned

Each of these projects underscores certain lessons:

- Zig can handle low-level details needed in compilers (manual memory, careful layout, calling into other libraries).
- Error handling and diagnostics are given first-class consideration (for instance, Zig's compiler and Aro put effort into detailed errors, leveraging the compiler's knowledge of code).
- Performance is achievable; Zig compilers can be extremely fast. Reports from Zig's development indicate it can parse and analyze very quickly (as that HN thread discussed, even naive parsers often don't bottleneck). In fact, a goal for Zig is to allow incremental compilation or super-fast recompilation, which means the compiler itself must be efficient in managing data and possibly doing incremental updates to AST/IR. Designing with that in mind (for example, structuring AST for partial rebuild, or allowing reuse of symbol tables) could be an advanced consideration.

**Community and maintenance:** because Zig is still young (not 1.0 yet), projects sometimes need to update to new Zig versions frequently. Keeping a compiler project up-to-date with Zig might require adjustments as the language evolves (for example, syntax changes, or std lib changes). Writing comprehensive tests for your compiler in Zig's test blocks will help catch breakages when you upgrade Zig.

## Conclusion

Writing a compiler in Zig is a journey that benefits from Zig's system-level control, clarity, and performance. We started from lexing – using straightforward loops and switches to tokenize efficiently – then built a parser with recursive descent, carefully managing errors and memory. We represented our language's AST in a way that is idiomatic for Zig (either simple unions or advanced multi-array storage), and we saw how semantic analysis can be implemented cleanly with Zig's data structures (hash maps for symbol tables, etc.), leveraging Zig's strengths (explicit control flow, lack of hidden magic) to ensure we catch errors and perhaps even optimize (constant folding). We explored options for backend code generation, from emitting WebAssembly for portability to tapping into LLVM or using a JIT, noting that Zig gives us the freedom to choose any of these by interfacing at a low level or by generating binaries directly. Throughout, we highlighted best practices: no unnecessary allocations, use of arenas, collecting errors for good diagnostics, modular design, and learning from Zig's own compiler and other Zig-based language projects.

Zig's philosophy – "maintainable, robust, and optimal" – aligns well with compiler construction. You can write very maintainable code (thanks to clear semantics and lack of hidden control flow), robust software (by handling errors explicitly and using the type system to your advantage), and achieve optimal performance (manual memory management, the ability to use SIMD, and fine-grained control where needed). By following the patterns in this guide and the lessons from existing projects, a compiler author can create a new programming language or transpiler in Zig that is both practical (easy to work with and integrate) and fast. The end result is that Zig not only enables writing compilers, but actually makes it an enjoyable engineering task – giving you low-level power without sacrificing readability. As the Zig motto goes, it's all about enabling "robust, optimal and reusable software," and compilers are no exception to that rule. With Zig, you can focus on the uniqueness of your language, confident that the language you're implementing it in has your back on performance and reliability.

---

## Sources

- Zig standard library tokenizer and parser design[7][25][6]
- Mitchell Hashimoto's Zig Compiler Internals articles[48][9][18][19]
- Zig language forum discussions on parser implementation and Zig idioms[1][3]
- Zig's self-hosted compiler data-oriented structures (MultiArrayList)[4][23]
- Aro C compiler integration with Zig backends[32]
- Buzz language JIT compilation with MIR[36]
- Zig community projects list (compilers and interpreters)[49] (e.g., Zua Lua interpreter, Bog, Fury, etc.)
- Loris Cro's commentary on Zig's cross-compilation and WASI support[33]
- Hacker News discussion on high-throughput Zig parsing and SIMD[16]

## References

[1] [2] [3] [15] Learning Zig by creating a parser - Help - Ziggit
https://ziggit.dev/t/learning-zig-by-creating-a-parser/4970

[4] [5] [6] [18] [19] [20] [21] [22] [23] [24] [25] [26] [27] [28] [29] [42] Zig Parser – Mitchell Hashimoto
https://mitchellh.com/zig/parser

[7] [8] [9] [10] [11] [12] [13] [14] [48] Zig Tokenizer – Mitchell Hashimoto
https://mitchellh.com/zig/tokenizer

[16] [17] A high-throughput parser for the Zig programming language | Hacker News
https://news.ycombinator.com/item?id=43705824

[30] [31] Notes From the Field: Learning Zig - by Thorsten Ball
https://registerspill.thorstenball.com/p/notes-from-the-field-learning-zig

[32] [38] Aro - a C compiler
https://aro.vexu.eu/

[33] Creating an Efficient Language with Zig | Fastly | Fastly
https://www.fastly.com/blog/building-an-efficient-and-portable-programming-language-with-zig

[34] [35] [37] [41] [45] [47] [49] GitHub - zigcc/awesome-zig: A collection of awesome projects in Zig.
https://github.com/zigcc/awesome-zig

[36] [46] buzz
https://buzz-lang.dev

[39] [40] Zig as a C and C++ compiler : r/Zig
https://www.reddit.com/r/Zig/comments/1lz2ez9/zig_as_a_c_and_c_compiler/

[43] [44] Zig – Mitchell Hashimoto
https://mitchellh.com/zig
