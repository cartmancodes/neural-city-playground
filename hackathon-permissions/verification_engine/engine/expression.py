"""Safe parser + evaluator for the python_logic pseudo-code field.

Supported grammar:

    rule := IF cond ":" REQUIRE cond
          | REQUIRE cond
    cond := orexpr
    orexpr := andexpr ("OR" andexpr)*
    andexpr := notexpr ("AND" notexpr)*
    notexpr := "NOT" notexpr | atom
    atom := "(" cond ")" | comparison
    comparison := value op value
    op := ">" | ">=" | "<" | "<=" | "==" | "!="
    value := identifier | number | "True" | "False"

We REFUSE function calls, attribute access, indexing, and any unknown token —
the rule is reported as manual_review rather than executed unsafely.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Number = float | int
Value = Number | bool


class UnsupportedExpression(ValueError):
    pass


@dataclass
class Token:
    kind: str
    value: str


_TOKEN_RE = re.compile(
    r"\s*(?:"
    r"(?P<NUMBER>\d+(?:\.\d+)?)|"
    r"(?P<COMP>>=|<=|==|!=|>|<)|"
    r"(?P<LPAREN>\()|"
    r"(?P<RPAREN>\))|"
    r"(?P<COLON>:)|"
    r"(?P<IDENT>[A-Za-z_][A-Za-z0-9_]*)"
    r")"
)


def _tokenize(src: str) -> list[Token]:
    tokens: list[Token] = []
    pos = 0
    while pos < len(src):
        # Skip leading whitespace
        while pos < len(src) and src[pos].isspace():
            pos += 1
        if pos >= len(src):
            break
        m = _TOKEN_RE.match(src, pos)
        if not m or m.start() != pos:
            raise UnsupportedExpression(f"unexpected character at {pos}: {src[pos:pos+8]!r}")
        kind = m.lastgroup
        value = m.group(kind)
        if kind == "IDENT":
            upper = value.upper()
            if upper in {"IF", "REQUIRE", "AND", "OR", "NOT"}:
                tokens.append(Token(upper, value))
            elif value in {"True", "False"}:
                tokens.append(Token("BOOL", value))
            else:
                tokens.append(Token("IDENT", value))
        else:
            tokens.append(Token(kind, value))
        pos = m.end()
    return tokens


# AST node types
@dataclass
class Ident:
    name: str


@dataclass
class Lit:
    value: Value


@dataclass
class Compare:
    left: object
    op: str
    right: object


@dataclass
class And:
    parts: list


@dataclass
class Or:
    parts: list


@dataclass
class Not:
    inner: object


@dataclass
class Rule:
    cond: object | None  # the IF condition; None if just REQUIRE
    require: object  # condition that must hold


class _Parser:
    def __init__(self, tokens: list[Token]) -> None:
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> Token | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def eat(self, kind: str) -> Token:
        tok = self.peek()
        if tok is None or tok.kind != kind:
            raise UnsupportedExpression(f"expected {kind}, got {tok}")
        self.pos += 1
        return tok

    def maybe(self, kind: str) -> Token | None:
        tok = self.peek()
        if tok and tok.kind == kind:
            self.pos += 1
            return tok
        return None

    def parse_rule(self) -> Rule:
        if self.maybe("IF"):
            cond = self.parse_or()
            self.eat("COLON")
            self.eat("REQUIRE")
            req = self.parse_or()
            self._end()
            return Rule(cond=cond, require=req)
        self.eat("REQUIRE")
        req = self.parse_or()
        self._end()
        return Rule(cond=None, require=req)

    def _end(self) -> None:
        if self.peek() is not None:
            raise UnsupportedExpression(f"unexpected trailing tokens: {self.tokens[self.pos:]}")

    def parse_or(self) -> object:
        parts = [self.parse_and()]
        while self.maybe("OR"):
            parts.append(self.parse_and())
        return parts[0] if len(parts) == 1 else Or(parts)

    def parse_and(self) -> object:
        parts = [self.parse_not()]
        while self.maybe("AND"):
            parts.append(self.parse_not())
        return parts[0] if len(parts) == 1 else And(parts)

    def parse_not(self) -> object:
        if self.maybe("NOT"):
            return Not(self.parse_not())
        return self.parse_atom()

    def parse_atom(self) -> object:
        if self.maybe("LPAREN"):
            inner = self.parse_or()
            self.eat("RPAREN")
            return inner
        return self.parse_compare()

    def parse_compare(self) -> Compare:
        left = self.parse_value()
        op_tok = self.maybe("COMP")
        if not op_tok:
            raise UnsupportedExpression(f"expected comparator after {left}")
        right = self.parse_value()
        return Compare(left=left, op=op_tok.value, right=right)

    def parse_value(self) -> object:
        tok = self.peek()
        if tok is None:
            raise UnsupportedExpression("unexpected end of expression")
        if tok.kind == "NUMBER":
            self.pos += 1
            return Lit(float(tok.value) if "." in tok.value else int(tok.value))
        if tok.kind == "BOOL":
            self.pos += 1
            return Lit(tok.value == "True")
        if tok.kind == "IDENT":
            # Reject f(x) — function-call style
            self.pos += 1
            nxt = self.peek()
            if nxt and nxt.kind == "LPAREN":
                raise UnsupportedExpression(f"function calls are not supported: {tok.value}(...)")
            return Ident(tok.value)
        raise UnsupportedExpression(f"unexpected token: {tok}")


def parse_logic(src: str) -> Rule:
    tokens = _tokenize(src)
    parser = _Parser(tokens)
    return parser.parse_rule()


@dataclass
class Verdict:
    status: Literal["pass", "fail", "manual_review"]
    reason: str


_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def _resolve(node: object, env: dict[str, Value]) -> Value:
    if isinstance(node, Lit):
        return node.value
    if isinstance(node, Ident):
        if node.name not in env:
            raise KeyError(node.name)
        return env[node.name]
    raise UnsupportedExpression(f"value expected, got {node}")


def _eval(node: object, env: dict[str, Value]) -> bool:
    if isinstance(node, Compare):
        a = _resolve(node.left, env)
        b = _resolve(node.right, env)
        return _OPS[node.op](a, b)
    if isinstance(node, And):
        return all(_eval(p, env) for p in node.parts)
    if isinstance(node, Or):
        return any(_eval(p, env) for p in node.parts)
    if isinstance(node, Not):
        return not _eval(node.inner, env)
    raise UnsupportedExpression(f"condition expected, got {node}")


def evaluate(rule: Rule, env: dict[str, Value]) -> Verdict:
    try:
        if rule.cond is not None and not _eval(rule.cond, env):
            return Verdict(status="pass", reason="precondition not applicable")
        ok = _eval(rule.require, env)
        if ok:
            return Verdict(status="pass", reason="check satisfied")
        return Verdict(status="fail", reason="required condition not met")
    except KeyError as e:
        return Verdict(status="manual_review", reason=f"missing input: {e.args[0]}")
    except UnsupportedExpression as e:
        return Verdict(status="manual_review", reason=f"unsupported expression: {e}")
