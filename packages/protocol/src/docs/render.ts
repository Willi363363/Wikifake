// Turning a schema into prose a reader can check a client against.
//
// C8.2 — the current lock is regex Python over hand-written Markdown, and it
// dies with the Python. Here the documentation is *generated* from the schemas,
// so it cannot describe a protocol that does not exist: the only way to change
// the document is to change the contract.
//
// The input is JSON Schema rather than Zod internals. `z.toJSONSchema` is a
// supported surface and `.def` is not, so a Zod upgrade cannot silently reshape
// the output.
import { z } from 'zod';

/** Beyond this, an integer bound is `Number.MAX_SAFE_INTEGER` — noise, not a rule. */
const UNBOUNDED = 9_007_199_254_740_991;

interface JsonSchema {
  readonly type?: string | readonly string[];
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly anyOf?: readonly JsonSchema[];
  /** A discriminated union converts to `oneOf`, a plain one to `anyOf`. */
  readonly oneOf?: readonly JsonSchema[];
  readonly items?: JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly propertyNames?: JsonSchema;
  readonly additionalProperties?: JsonSchema | boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minItems?: number;
  readonly pattern?: string;
  readonly default?: unknown;
  readonly description?: string;
}

function isObjectSchema(schema: JsonSchema): boolean {
  return schema.properties !== undefined && Object.keys(schema.properties).length > 0;
}

/** The variants of a union, whichever keyword carried them. */
function variantsOf(schema: JsonSchema): readonly JsonSchema[] {
  return schema.oneOf ?? schema.anyOf ?? [];
}

/**
 * A union of two or more object shapes — `hint_unlocked.grant`, where what the
 * level grants is a union on the level itself rather than a pair of optional
 * fields. Rendered as its shapes, since that difference is the contract.
 */
function objectVariants(schema: JsonSchema): readonly JsonSchema[] {
  const objects = variantsOf(schema).filter(isObjectSchema);
  return objects.length >= 2 ? objects : [];
}

function stringBounds(schema: JsonSchema): string {
  const parts: string[] = [];
  if (schema.minLength !== undefined && schema.maxLength === schema.minLength) {
    parts.push(`exactly ${schema.minLength} chars`);
  } else if (schema.minLength !== undefined && schema.maxLength !== undefined) {
    parts.push(`${schema.minLength}–${schema.maxLength} chars`);
  } else if (schema.minLength !== undefined) {
    parts.push(`min ${schema.minLength} ${schema.minLength === 1 ? 'char' : 'chars'}`);
  } else if (schema.maxLength !== undefined) {
    parts.push(`max ${schema.maxLength} ${schema.maxLength === 1 ? 'char' : 'chars'}`);
  }
  if (schema.pattern !== undefined) parts.push(`matching \`${schema.pattern}\``);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function numberBounds(schema: JsonSchema): string {
  const low =
    schema.minimum !== undefined && schema.minimum > -UNBOUNDED ? schema.minimum : null;
  const high =
    schema.maximum !== undefined && schema.maximum < UNBOUNDED ? schema.maximum : null;
  if (low !== null && high !== null) return ` (${low}–${high})`;
  if (low !== null) return ` (≥ ${low})`;
  if (high !== null) return ` (≤ ${high})`;
  return '';
}

/** A one-line description of a schema. Nested objects are handled by the caller. */
export function describeType(schema: JsonSchema): string {
  if (schema.description !== undefined) return schema.description;
  if (schema.const !== undefined) return `\`${JSON.stringify(schema.const)}\``;
  if (schema.enum !== undefined) {
    return schema.enum.map((value) => `\`${JSON.stringify(value)}\``).join(' | ');
  }
  const variants = variantsOf(schema);
  if (variants.length > 0) {
    const shapes = objectVariants(schema);
    return shapes.length > 0
      ? `one of ${shapes.length} shapes`
      : variants.map(describeType).join(' | ');
  }

  if (schema.type === 'array') {
    const inner = schema.items === undefined ? 'unknown' : describeType(schema.items);
    const nonEmpty =
      schema.minItems !== undefined && schema.minItems > 0 ? 'non-empty ' : '';
    return schema.items !== undefined && isObjectSchema(schema.items)
      ? `${nonEmpty}array of objects`
      : `${nonEmpty}array of ${inner}`;
  }

  if (schema.type === 'object') {
    if (schema.propertyNames !== undefined) {
      const value =
        typeof schema.additionalProperties === 'object'
          ? describeType(schema.additionalProperties)
          : 'unknown';
      const key = describeType(schema.propertyNames);
      return isObjectSchema(
        typeof schema.additionalProperties === 'object'
          ? schema.additionalProperties
          : {},
      )
        ? `record keyed by ${key}, of objects`
        : `record keyed by ${key}, of ${value}`;
    }
    return isObjectSchema(schema) ? 'object' : 'object';
  }

  if (schema.type === 'string') return `string${stringBounds(schema)}`;
  if (schema.type === 'integer') return `integer${numberBounds(schema)}`;
  if (schema.type === 'number') return `number${numberBounds(schema)}`;
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'null') return 'null';
  return 'unknown';
}

/** The object a nested description should descend into, if any. */
function childOf(schema: JsonSchema): JsonSchema | null {
  if (
    schema.type === 'array' &&
    schema.items !== undefined &&
    isObjectSchema(schema.items)
  ) {
    return schema.items;
  }
  if (schema.type === 'object' && schema.propertyNames !== undefined) {
    return typeof schema.additionalProperties === 'object' &&
      isObjectSchema(schema.additionalProperties)
      ? schema.additionalProperties
      : null;
  }
  if (isObjectSchema(schema)) return schema;
  const variants = variantsOf(schema);
  if (variants.length > 0 && objectVariants(schema).length === 0) {
    return (
      variants.find((option) => isObjectSchema(option) || childOf(option) !== null) ??
      null
    );
  }
  return null;
}

function fieldLines(schema: JsonSchema, depth: number): string[] {
  const indent = '  '.repeat(depth);
  const required = new Set(schema.required ?? []);
  const lines: string[] = [];

  for (const [name, field] of Object.entries(schema.properties ?? {})) {
    const notes: string[] = [];
    if (!required.has(name)) {
      notes.push(
        field.default === undefined
          ? 'optional'
          : `default \`${JSON.stringify(field.default)}\``,
      );
    }
    const suffix = notes.length > 0 ? ` — ${notes.join(', ')}` : '';
    lines.push(`${indent}- \`${name}\` — ${describeType(field)}${suffix}`);

    const shapes = objectVariants(field);
    if (shapes.length > 0) {
      for (const [at, shape] of shapes.entries()) {
        lines.push(`${indent}  - shape ${at + 1}`);
        lines.push(...fieldLines(shape, depth + 2));
      }
      continue;
    }

    const child = childOf(field);
    if (child !== null) lines.push(...fieldLines(child, depth + 1));
  }

  return lines;
}

/** A whole schema, as a Markdown fragment: a bullet per field, nested. */
export function describeSchema(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { io: 'input' }) as JsonSchema;
  const lines = isObjectSchema(json) ? fieldLines(json, 0) : [`- ${describeType(json)}`];
  return lines.length > 0 ? lines.join('\n') : '- no fields';
}
