// ============================================
// Database Module - SQLite via better-sqlite3
// ============================================
// Reads schema/*.json → creates tables → provides CRUD operations
// ============================================

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
const SCHEMA_DIR = path.join(__dirname, 'schema');

let db = null;

// SQLite type mapping from schema field types
function mapFieldType(field) {
  const typeMap = {
    'number': field.name.includes('price') || field.name.includes('amount') || field.name.includes('weight') ? 'REAL' : 'INTEGER',
    'text': 'TEXT',
    'email': 'TEXT',
    'password': 'TEXT',
    'textarea': 'TEXT',
    'url': 'TEXT',
    'boolean': 'INTEGER',
    'date': 'TEXT',
    'datetime': 'TEXT',
    'time': 'TEXT',
    'select': 'TEXT',
    'radio': 'TEXT',
    'checkbox': 'INTEGER',
    'file': 'TEXT',
    'image': 'TEXT',
    'json': 'TEXT',
    'enum': 'TEXT'
  };
  return typeMap[field.type] || 'TEXT';
}

// Generate CREATE TABLE SQL from schema JSON
function schemaToCreateSQL(schema) {
  const pk = schema.primaryKey || 'id';
  const lines = [];

  for (const field of schema.fields) {
    if (field.name === pk) {
      // Primary key with autoincrement
      lines.push(`  "${field.name}" INTEGER PRIMARY KEY AUTOINCREMENT`);
      continue;
    }

    let col = `  "${field.name}" ${mapFieldType(field)}`;
    if (field.required) col += ' NOT NULL';
    if (field.defaultValue !== undefined) {
      const def = typeof field.defaultValue === 'string' ? `'${field.defaultValue}'` : field.defaultValue;
      col += ` DEFAULT ${def}`;
    }
    lines.push(col);
  }

  // Timestamps
  if (schema.timestamps) {
    if (schema.timestamps.createdAt) {
      lines.push(`  "${schema.timestamps.createdAt}" DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
    if (schema.timestamps.updatedAt) {
      lines.push(`  "${schema.timestamps.updatedAt}" DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }
  }

  return `CREATE TABLE IF NOT EXISTS "${schema.name}" (\n${lines.join(',\n')}\n);`;
}

// Load all schemas from /schema folder
function loadSchemas() {
  const schemas = {};
  if (!fs.existsSync(SCHEMA_DIR)) return schemas;

  const files = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
      if (content.name) {
        schemas[content.name] = content;
      }
    } catch (e) {
      console.warn(`Failed to parse schema file ${file}:`, e.message);
    }
  }
  return schemas;
}

// Initialize database: open connection + create tables from schemas
function init() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemas = loadSchemas();
  const tableNames = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const sql = schemaToCreateSQL(schema);
    console.log(`[DB] Creating table if not exists: ${name}`);
    db.exec(sql);
    tableNames.push(name);
  }

  console.log(`[DB] SQLite ready at ${DB_PATH} (tables: ${tableNames.join(', ')})`);
  return db;
}

// Get the raw db handle
function getDb() {
  return db;
}

// Get schema for a table
function getSchema(tableName) {
  const schemas = loadSchemas();
  return schemas[tableName] || null;
}

// Get all table names that have schemas
function getTableNames() {
  return Object.keys(loadSchemas());
}

// ============================================
// Generic CRUD operations
// ============================================

// List rows with pagination and search
function list(table, options = {}) {
  const { page = 1, perPage = 10, search = '', searchFields = [], sort = '', order = 'asc' } = options;

  let whereClause = '';
  const params = {};

  // Search
  if (search && searchFields.length > 0) {
    const conditions = searchFields.map((f, i) => {
      params[`search${i}`] = `%${search}%`;
      return `"${f}" LIKE @search${i}`;
    });
    whereClause = `WHERE ${conditions.join(' OR ')}`;
  }

  // Count total
  const countSQL = `SELECT COUNT(*) as total FROM "${table}" ${whereClause}`;
  const { total } = db.prepare(countSQL).get(params);

  // Sort
  let orderClause = '';
  if (sort) {
    const dir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    orderClause = `ORDER BY "${sort}" ${dir}`;
  } else {
    orderClause = 'ORDER BY rowid DESC';
  }

  // Pagination
  const offset = (page - 1) * perPage;
  params.limit = perPage;
  params.offset = offset;

  const dataSQL = `SELECT * FROM "${table}" ${whereClause} ${orderClause} LIMIT @limit OFFSET @offset`;
  const data = db.prepare(dataSQL).all(params);

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
}

// Get single row by id
function getById(table, id) {
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';
  return db.prepare(`SELECT * FROM "${table}" WHERE "${pk}" = ?`).get(id);
}

// Insert a new row
function create(table, data) {
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';

  // Filter out the primary key (autoIncrement) and unknown columns
  const validFields = schema ? schema.fields.map(f => f.name).filter(f => f !== pk) : Object.keys(data);
  const fields = validFields.filter(f => data[f] !== undefined);

  // For required (NOT NULL) fields not provided, supply a default to avoid constraint errors
  if (schema) {
    for (const field of schema.fields) {
      if (field.name === pk) continue;
      if (field.required && !fields.includes(field.name)) {
        fields.push(field.name);
        if (field.defaultValue !== undefined) {
          data[field.name] = field.defaultValue;
        } else if (field.type === 'number') {
          data[field.name] = 0;
        } else {
          data[field.name] = '';
        }
      }
    }
  }

  // Add updatedAt timestamp if schema has it
  if (schema?.timestamps?.updatedAt && !fields.includes(schema.timestamps.updatedAt)) {
    fields.push(schema.timestamps.updatedAt);
    data[schema.timestamps.updatedAt] = new Date().toISOString();
  }
  if (schema?.timestamps?.createdAt && !fields.includes(schema.timestamps.createdAt)) {
    fields.push(schema.timestamps.createdAt);
    data[schema.timestamps.createdAt] = new Date().toISOString();
  }

  const placeholders = fields.map(f => `@${f}`);
  const sql = `INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders.join(', ')})`;

  const params = {};
  for (const f of fields) {
    params[f] = data[f] !== undefined ? data[f] : null;
  }

  const result = db.prepare(sql).run(params);
  return { id: result.lastInsertRowid, ...data };
}

// Update a row by id
function update(table, id, data) {
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';

  // Remove pk from update fields
  const fields = Object.keys(data).filter(f => f !== pk);

  // Auto-update updatedAt
  if (schema?.timestamps?.updatedAt) {
    const uaField = schema.timestamps.updatedAt;
    if (!fields.includes(uaField)) {
      fields.push(uaField);
      data[uaField] = new Date().toISOString();
    }
  }

  if (fields.length === 0) return null;

  const setClause = fields.map(f => `"${f}" = @${f}`).join(', ');
  const sql = `UPDATE "${table}" SET ${setClause} WHERE "${pk}" = @_pk_`;

  const params = { _pk_: id };
  for (const f of fields) {
    params[f] = data[f] !== undefined ? data[f] : null;
  }

  const result = db.prepare(sql).run(params);
  if (result.changes === 0) return null;
  return getById(table, id);
}

// Delete a row by id
function remove(table, id) {
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';
  const result = db.prepare(`DELETE FROM "${table}" WHERE "${pk}" = ?`).run(id);
  return result.changes > 0;
}

// Bulk delete
function bulkDelete(table, ids) {
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';
  const placeholders = ids.map(() => '?').join(', ');
  const result = db.prepare(`DELETE FROM "${table}" WHERE "${pk}" IN (${placeholders})`).run(...ids);
  return result.changes;
}

module.exports = {
  init,
  getDb,
  getSchema,
  getTableNames,
  loadSchemas,
  schemaToCreateSQL,
  // CRUD
  list,
  getById,
  create,
  update,
  remove,
  bulkDelete
};
