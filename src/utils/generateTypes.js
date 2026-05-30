// Infer a normalized IR from JSON value
function inferType(value) {
  if (value === null) return { kind: 'null' }
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', item: { kind: 'unknown' } }
    // Merge all item types
    const itemType = mergeTypes(value.map(inferType))
    return { kind: 'array', item: itemType }
  }
  if (typeof value === 'object') {
    const fields = {}
    for (const [k, v] of Object.entries(value)) {
      fields[k] = inferType(v)
    }
    return { kind: 'object', fields }
  }
  return { kind: typeof value } // 'string' | 'number' | 'boolean'
}

function mergeTypes(types) {
  const unique = dedupTypes(types)
  if (unique.length === 1) return unique[0]
  // If all are objects, merge their fields
  if (unique.every(t => t.kind === 'object')) {
    const allKeys = [...new Set(unique.flatMap(t => Object.keys(t.fields)))]
    const fields = {}
    for (const k of allKeys) {
      const fieldTypes = unique.filter(t => k in t.fields).map(t => t.fields[k])
      const missing = unique.length - fieldTypes.length
      const merged = mergeTypes(fieldTypes)
      fields[k] = missing > 0 ? { kind: 'optional', inner: merged } : merged
    }
    return { kind: 'object', fields }
  }
  return { kind: 'union', types: unique }
}

function dedupTypes(types) {
  const seen = []
  for (const t of types) {
    if (!seen.some(s => typeEqual(s, t))) seen.push(t)
  }
  return seen
}

function typeEqual(a, b) {
  if (a.kind !== b.kind) return false
  if (a.kind === 'object') {
    const ak = Object.keys(a.fields), bk = Object.keys(b.fields)
    if (ak.length !== bk.length) return false
    return ak.every(k => bk.includes(k) && typeEqual(a.fields[k], b.fields[k]))
  }
  if (a.kind === 'array') return typeEqual(a.item, b.item)
  if (a.kind === 'union') return a.types.length === b.types.length && a.types.every((t, i) => typeEqual(t, b.types[i]))
  return true
}

// ── TypeScript ────────────────────────────────────────────────────────────────

function tsType(ir, indent = 0, nameHint = 'Root', interfaces = [], isTop = false) {
  switch (ir.kind) {
    case 'string':  return 'string'
    case 'number':  return 'number'
    case 'boolean': return 'boolean'
    case 'null':    return 'null'
    case 'unknown': return 'unknown'
    case 'optional': {
      const inner = tsType(ir.inner, indent, nameHint, interfaces)
      return `${inner} | undefined`
    }
    case 'union': {
      return ir.types.map(t => tsType(t, indent, nameHint, interfaces)).join(' | ')
    }
    case 'array': {
      const item = tsType(ir.item, indent, nameHint + 'Item', interfaces)
      return `${item}[]`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const pad = '  '.repeat(indent + 1)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = tsType(inner, indent + 1, toPascalCase(k), interfaces)
        return `${pad}${safeKey(k)}${optional ? '?' : ''}: ${t};`
      })
      if (isTop || indent === 0) {
        interfaces.push(`export interface ${name} {\n${fields.join('\n')}\n}`)
        return name
      }
      // nested objects become their own interfaces
      interfaces.push(`export interface ${name} {\n${fields.join('\n')}\n}`)
      return name
    }
    default: return 'any'
  }
}

export function generateTypeScript(data) {
  const ir = inferType(data)
  const interfaces = []
  tsType(ir, 0, 'Root', interfaces, true)
  return interfaces.join('\n\n')
}

// ── Zod ───────────────────────────────────────────────────────────────────────

function zodSchema(ir, indent = 0, nameHint = 'root', schemas = [], isTop = false) {
  const pad = '  '.repeat(indent)
  switch (ir.kind) {
    case 'string':  return 'z.string()'
    case 'number':  return 'z.number()'
    case 'boolean': return 'z.boolean()'
    case 'null':    return 'z.null()'
    case 'unknown': return 'z.unknown()'
    case 'optional': return `${zodSchema(ir.inner, indent, nameHint, schemas)}.optional()`
    case 'union': {
      const members = ir.types.map(t => zodSchema(t, indent, nameHint, schemas))
      return `z.union([${members.join(', ')}])`
    }
    case 'array': {
      const item = zodSchema(ir.item, indent, nameHint + 'Item', schemas)
      return `z.array(${item})`
    }
    case 'object': {
      const name = toCamelCase(nameHint) + 'Schema'
      const innerPad = '  '.repeat(indent + 1)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const s = zodSchema(inner, indent + 1, toCamelCase(k), schemas)
        return `${innerPad}${safeKey(k)}: ${s}${optional ? '.optional()' : ''},`
      })
      const def = `export const ${name} = z.object({\n${fields.join('\n')}\n${pad}})`
      schemas.push(def)
      return name
    }
    default: return 'z.any()'
  }
}

export function generateZod(data) {
  const ir = inferType(data)
  const schemas = []
  zodSchema(ir, 0, 'root', schemas, true)
  return `import { z } from 'zod'\n\n` + schemas.join('\n\n')
}

// ── JSON Schema ───────────────────────────────────────────────────────────────

function jsonSchemaNode(ir) {
  switch (ir.kind) {
    case 'string':  return { type: 'string' }
    case 'number':  return { type: 'number' }
    case 'boolean': return { type: 'boolean' }
    case 'null':    return { type: 'null' }
    case 'unknown': return {}
    case 'optional': return jsonSchemaNode(ir.inner)
    case 'union': return { oneOf: ir.types.map(jsonSchemaNode) }
    case 'array': return { type: 'array', items: jsonSchemaNode(ir.item) }
    case 'object': {
      const props = {}
      const required = []
      for (const [k, v] of Object.entries(ir.fields)) {
        const optional = v.kind === 'optional'
        props[k] = jsonSchemaNode(optional ? v.inner : v)
        if (!optional) required.push(k)
      }
      const schema = { type: 'object', properties: props }
      if (required.length) schema.required = required
      return schema
    }
    default: return {}
  }
}

export function generateJsonSchema(data) {
  const ir = inferType(data)
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...jsonSchemaNode(ir),
  }
  return JSON.stringify(schema, null, 2)
}

// ── AJV (JSON Schema with AJV compile snippet) ────────────────────────────────

export function generateAjv(data) {
  const schema = generateJsonSchema(data)
  return `import Ajv from 'ajv'\n\nconst ajv = new Ajv()\n\nconst schema = ${schema}\n\nexport const validate = ajv.compile(schema)`
}

// ── Go ────────────────────────────────────────────────────────────────────────

function goType(ir, nameHint = 'Root', structs = []) {
  switch (ir.kind) {
    case 'string':  return 'string'
    case 'number':  return 'float64'
    case 'boolean': return 'bool'
    case 'null':    return 'interface{}'
    case 'unknown': return 'interface{}'
    case 'optional': return `*${goType(ir.inner, nameHint, structs)}`
    case 'union':   return 'interface{}'
    case 'array': {
      const item = goType(ir.item, nameHint + 'Item', structs)
      return `[]${item}`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = goType(inner, toPascalCase(k), structs)
        const ptr = optional ? '*' : ''
        return `\t${toPascalCase(k)} ${ptr}${t} \`json:"${k}"\``
      })
      structs.push(`type ${name} struct {\n${fields.join('\n')}\n}`)
      return name
    }
    default: return 'interface{}'
  }
}

export function generateGo(data) {
  const ir = inferType(data)
  const structs = []
  goType(ir, 'Root', structs)
  return `package main\n\n` + structs.join('\n\n')
}

// ── Rust ──────────────────────────────────────────────────────────────────────

function rustType(ir, nameHint = 'Root', structs = []) {
  switch (ir.kind) {
    case 'string':  return 'String'
    case 'number':  return 'f64'
    case 'boolean': return 'bool'
    case 'null':    return '()'
    case 'unknown': return 'serde_json::Value'
    case 'optional': return `Option<${rustType(ir.inner, nameHint, structs)}>`
    case 'union':   return 'serde_json::Value'
    case 'array': {
      const item = rustType(ir.item, nameHint + 'Item', structs)
      return `Vec<${item}>`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = rustType(inner, toPascalCase(k), structs)
        const finalType = optional ? `Option<${t}>` : t
        const snakeKey = toSnakeCase(k)
        const rename = snakeKey !== k ? `    #[serde(rename = "${k}")]\n` : ''
        return `${rename}    pub ${snakeKey}: ${finalType},`
      })
      structs.push(`#[derive(Debug, Serialize, Deserialize)]\npub struct ${name} {\n${fields.join('\n')}\n}`)
      return name
    }
    default: return 'serde_json::Value'
  }
}

export function generateRust(data) {
  const ir = inferType(data)
  const structs = []
  rustType(ir, 'Root', structs)
  return `use serde::{Deserialize, Serialize};\n\n` + structs.join('\n\n')
}

// ── Kotlin ────────────────────────────────────────────────────────────────────

function kotlinType(ir, nameHint = 'Root', classes = []) {
  switch (ir.kind) {
    case 'string':  return 'String'
    case 'number':  return 'Double'
    case 'boolean': return 'Boolean'
    case 'null':    return 'Any?'
    case 'unknown': return 'Any'
    case 'optional': return `${kotlinType(ir.inner, nameHint, classes)}?`
    case 'union':   return 'Any'
    case 'array': {
      const item = kotlinType(ir.item, nameHint + 'Item', classes)
      return `List<${item}>`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = kotlinType(inner, toPascalCase(k), classes)
        const nullable = optional ? '?' : ''
        return `    val ${toCamelCase(k)}: ${t}${nullable},`
      })
      classes.push(`data class ${name}(\n${fields.join('\n')}\n)`)
      return name
    }
    default: return 'Any'
  }
}

export function generateKotlin(data) {
  const ir = inferType(data)
  const classes = []
  kotlinType(ir, 'Root', classes)
  return classes.join('\n\n')
}

// ── Python (Pydantic) ─────────────────────────────────────────────────────────

function pyType(ir, nameHint = 'Root', models = []) {
  switch (ir.kind) {
    case 'string':  return 'str'
    case 'number':  return 'float'
    case 'boolean': return 'bool'
    case 'null':    return 'None'
    case 'unknown': return 'Any'
    case 'optional': return `Optional[${pyType(ir.inner, nameHint, models)}]`
    case 'union': {
      const members = ir.types.map(t => pyType(t, nameHint, models))
      return `Union[${members.join(', ')}]`
    }
    case 'array': {
      const item = pyType(ir.item, nameHint + 'Item', models)
      return `List[${item}]`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = pyType(inner, toPascalCase(k), models)
        const snakeKey = toSnakeCase(k)
        if (optional) return `    ${snakeKey}: Optional[${t}] = None`
        return `    ${snakeKey}: ${t}`
      })
      models.push(`class ${name}(BaseModel):\n${fields.join('\n')}`)
      return name
    }
    default: return 'Any'
  }
}

export function generatePython(data) {
  const ir = inferType(data)
  const models = []
  pyType(ir, 'Root', models)
  return `from __future__ import annotations\nfrom typing import Any, List, Optional, Union\nfrom pydantic import BaseModel\n\n\n` + models.join('\n\n')
}

// ── Java ──────────────────────────────────────────────────────────────────────

function javaType(ir, nameHint = 'Root', classes = []) {
  switch (ir.kind) {
    case 'string':  return 'String'
    case 'number':  return 'Double'
    case 'boolean': return 'Boolean'
    case 'null':    return 'Object'
    case 'unknown': return 'Object'
    case 'optional': return javaType(ir.inner, nameHint, classes)
    case 'union':   return 'Object'
    case 'array': {
      const item = javaType(ir.item, nameHint + 'Item', classes)
      return `List<${item}>`
    }
    case 'object': {
      const name = toPascalCase(nameHint)
      const fields = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = javaType(inner, toPascalCase(k), classes)
        return `    private ${t} ${toCamelCase(k)};`
      })
      const getters = Object.entries(ir.fields).map(([k, v]) => {
        const optional = v.kind === 'optional'
        const inner = optional ? v.inner : v
        const t = javaType(inner, toPascalCase(k), [])
        const camel = toCamelCase(k)
        const pascal = toPascalCase(k)
        return `    public ${t} get${pascal}() { return ${camel}; }\n    public void set${pascal}(${t} ${camel}) { this.${camel} = ${camel}; }`
      })
      classes.push(`public class ${name} {\n${fields.join('\n')}\n\n${getters.join('\n')}\n}`)
      return name
    }
    default: return 'Object'
  }
}

export function generateJava(data) {
  const ir = inferType(data)
  const classes = []
  javaType(ir, 'Root', classes)
  return `import java.util.List;\n\n` + classes.join('\n\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPascalCase(str) {
  return String(str)
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase())
    || 'Field'
}

function toCamelCase(str) {
  const p = toPascalCase(str)
  return p.charAt(0).toLowerCase() + p.slice(1)
}

function toSnakeCase(str) {
  return String(str)
    .replace(/([A-Z])/g, '_$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_/, '')
    .toLowerCase()
}

function safeKey(k) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
}

export const LANGUAGES = [
  { id: 'typescript',  label: 'TypeScript',      ext: 'ts',   fn: generateTypeScript },
  { id: 'zod',         label: 'Zod',              ext: 'ts',   fn: generateZod },
  { id: 'jsonschema',  label: 'JSON Schema',      ext: 'json', fn: generateJsonSchema },
  { id: 'ajv',         label: 'AJV',              ext: 'ts',   fn: generateAjv },
  { id: 'go',          label: 'Go',               ext: 'go',   fn: generateGo },
  { id: 'rust',        label: 'Rust',             ext: 'rs',   fn: generateRust },
  { id: 'kotlin',      label: 'Kotlin',           ext: 'kt',   fn: generateKotlin },
  { id: 'python',      label: 'Python (Pydantic)','ext': 'py', fn: generatePython },
  { id: 'java',        label: 'Java',             ext: 'java', fn: generateJava },
]
