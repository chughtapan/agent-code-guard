import { type Block, type Line, type Spec, parse } from "comment-parser";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { attachmentFor, type AttachedCandidates } from "./jsdoc-attachments.js";

/** Categorizes a JSDoc description by its physical source. */
type DescriptionKind = "block" | "tag";

/** Locates one prose description within a JSDoc block. */
export interface DescriptionSpan {
  readonly kind: DescriptionKind;
  readonly tag?: string;
  readonly tagName?: string;
  readonly text: string;
  readonly range: readonly [number, number];
  readonly loc: TSESTree.SourceLocation;
}

/** Represents one parsed JSDoc tag. */
interface ParsedJsdocTag {
  readonly tag: string;
  readonly name: string;
  readonly description?: DescriptionSpan;
}

/** Represents the parsed structure and attachment of one JSDoc block. */
export interface ParsedJsdocBlock {
  readonly token: TSESLint.AST.Token;
  readonly description?: DescriptionSpan;
  readonly tags: readonly ParsedJsdocTag[];
  readonly attachment?: AttachedCandidates;
}

const TOKEN_FIELDS = [
  "start",
  "delimiter",
  "postDelimiter",
  "tag",
  "postTag",
  "type",
  "postType",
  "name",
  "postName",
  "description",
  "end",
  "lineEnd",
] as const;

const NAMED_TAGS = new Set(["param", "arg", "argument", "property", "prop"]);

/** Associates a parser line with source ranges for its physical token fields. */
interface MappedLine {
  readonly line: Line;
  readonly ranges: Readonly<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>>;
}

/** Holds one description fragment and its source location. */
interface Piece {
  readonly text: string;
  readonly range: readonly [number, number];
}

function mapLines(source: string, token: TSESLint.AST.Token, block: Block): readonly MappedLine[] {
  let cursor = token.range[0];
  return block.source.map((line) => {
    const ranges: Partial<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>> = {};
    for (const field of TOKEN_FIELDS) {
      const value = line.tokens[field];
      const start = cursor;
      cursor += value.length;
      ranges[field] = [start, cursor];
    }
    cursor += Number("\r\n".includes(source[cursor]));
    return {
      line,
      // eslint-disable-next-line agent-code-guard/require-assertion-rationale -- TOKEN_FIELDS fills every record key before this conversion.
      ranges: ranges as Readonly<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>>,
    };
  });
}

// eslint-disable-next-line max-params -- A span is defined by these five distinct parser dimensions.
function spanFromPieces(
  sourceCode: TSESLint.SourceCode,
  kind: DescriptionKind,
  // eslint-disable-next-line agent-code-guard/prefer-optional-over-undefined-union -- These positional parser slots distinguish an explicit absent tag from omitted arguments.
  tag: string | undefined,
  // eslint-disable-next-line agent-code-guard/prefer-optional-over-undefined-union -- These positional parser slots distinguish an explicit absent name from omitted arguments.
  tagName: string | undefined,
  pieces: readonly Piece[],
): DescriptionSpan | undefined {
  const nonEmpty = pieces.filter((piece) => /\S/u.test(piece.text));
  const first = nonEmpty.at(0);
  const last = nonEmpty.at(-1);
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const start = first.range[0] + first.text.length - first.text.trimStart().length;
  // eslint-disable-next-line sonarjs/slow-regex -- This suffix check runs on a single bounded JSDoc line.
  const endOffset = last.text.search(/\s*$/u);
  const range: readonly [number, number] = [
    start,
    last.range[0] + endOffset,
  ];
  return {
    kind,
    tag,
    tagName,
    text: pieces.filter((piece) => piece.text !== "").map((piece) => piece.text).join("\n"),
    range,
    loc: {
      start: sourceCode.getLocFromIndex(range[0]),
      end: sourceCode.getLocFromIndex(range[1]),
    },
  };
}

function descriptionPiece(mapped: MappedLine): Piece {
  return {
    text: mapped.line.tokens.description,
    range: mapped.ranges.description,
  };
}

function blockDescription(
  sourceCode: TSESLint.SourceCode,
  block: Block,
  mapped: readonly MappedLine[],
): DescriptionSpan | undefined {
  if (block.problems.length > 0) {
    return undefined;
  }
  const firstTag = mapped.findIndex((line) => line.line.tokens.tag !== "");
  const descriptionLines = firstTag === -1 ? mapped : mapped.slice(0, firstTag);
  return spanFromPieces(
    sourceCode,
    "block",
    undefined,
    undefined,
    descriptionLines.map(descriptionPiece),
  );
}

function tagDescription(
  sourceCode: TSESLint.SourceCode,
  spec: Spec,
  mapped: readonly MappedLine[],
): DescriptionSpan | undefined {
  if (spec.problems.length > 0) {
    return undefined;
  }
  const tagLine = mapped[0];
  const continuationLines = mapped.slice(mapped.indexOf(tagLine) + 1);
  const pieces = NAMED_TAGS.has(spec.tag)
    ? mapped.map(descriptionPiece)
    : [
        {
          text:
            tagLine.line.tokens.name +
            tagLine.line.tokens.postName +
            tagLine.line.tokens.description,
          range: [tagLine.ranges.name[0], tagLine.ranges.description[1]] as const,
        },
        ...continuationLines.map(descriptionPiece),
      ];
  return spanFromPieces(sourceCode, "tag", spec.tag, NAMED_TAGS.has(spec.tag) ? spec.name : undefined, pieces);
}

function isJSDoc(token: TSESLint.AST.Token, sourceCode: TSESLint.SourceCode): boolean {
  return sourceCode.text.slice(token.range[0], token.range[1]).startsWith("/**");
}

/**
 * Parses one JSDoc token using comment-parser's physical token offsets.
 * @param sourceCode Source text and locations for the current file.
 * @param token Block-comment token to parse.
 * @returns Parsed metadata when the token is a valid JSDoc block.
 */
function parseJsdocBlock(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
): ParsedJsdocBlock {
  const source = sourceCode.text.slice(token.range[0], token.range[1]);
  // comment-parser treats LF and CRLF as line endings but otherwise leaves a
  // bare CR inside one logical line. Normalize only bare CR bytes; preserving
  // length keeps its parser offsets aligned with the physical source token.
  const parserSource = source.replace(/\r(?!\n)/gu, "\n");
  const blocks = parse(parserSource, { startLine: token.loc.start.line, spacing: "preserve" });
  const block = blocks[0];
  const mapped = mapLines(sourceCode.text, token, block);
  return {
    token,
    description: blockDescription(sourceCode, block, mapped),
    tags: block.tags.map((spec) => ({
      tag: spec.tag,
      name: spec.name,
      description: tagDescription(
        sourceCode,
        spec,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, agent-code-guard/require-assertion-rationale -- comment-parser spec.source line numbers are a subset of its enclosing block.source lines.
        spec.source.map((line) => mapped.find((entry) => entry.line.number === line.number)!),
      ),
    })),
    attachment: attachmentFor(sourceCode, token),
  };
}

/**
 * Parses every JSDoc block comment in a source file.
 * @param sourceCode Source text and locations for the current file.
 * @returns Parsed metadata for every JSDoc block comment.
 */
export function parseJsdocBlocks(sourceCode: TSESLint.SourceCode): readonly ParsedJsdocBlock[] {
  return sourceCode
    .getAllComments()
    .filter((token) => isJSDoc(token, sourceCode))
    .map((token) => parseJsdocBlock(sourceCode, token));
}
