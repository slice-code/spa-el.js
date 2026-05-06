const http = require('http');
const fs = require('fs');
const path = require('path');
const database = require('./database');

const PORT = 3003;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ============================================
// API Routes for appjson (Private - Not Public)
// ============================================
const appjsonDir = path.join(__dirname, 'appjson');

// ============================================
// API Routes for schema (Private - Not Public)
// ============================================
const schemaDir = path.join(__dirname, 'schema');

function handleApiRoutes(req, res) {
  // GET /api/schema - List all available schemas
  if (req.url === '/api/schema' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
      const schemas = files.map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
        return {
          name: content.name,
          label: content.label,
          icon: content.icon,
          fieldsCount: content.fields?.length || 0
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: schemas }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/schema/:schemaName - Get specific schema
  if (req.url.startsWith('/api/schema/') && req.method === 'GET') {
    try {
      const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
      const filePath = path.join(schemaDir, `${schemaName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(schemaDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Schema not found' }));
        return true;
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/schema - Create new schema
  if (req.url === '/api/schema' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileName = data.name || 'schema';
        const filePath = path.join(schemaDir, `${fileName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(schemaDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Schema created', file: `${fileName}.json` }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // PUT /api/schema/:schemaName - Update schema
  if (req.url.startsWith('/api/schema/') && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
        const filePath = path.join(schemaDir, `${schemaName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(schemaDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        const data = JSON.parse(body);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Schema updated' }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // DELETE /api/schema/:schemaName - Delete schema
  if (req.url.startsWith('/api/schema/') && req.method === 'DELETE') {
    try {
      const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
      const filePath = path.join(schemaDir, `${schemaName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(schemaDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Schema not found' }));
        return true;
      }
      
      fs.unlinkSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Schema deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/pages - List all available pages
  if (req.url === '/api/pages' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(appjsonDir).filter(f => f.endsWith('.json'));
      const pages = files.map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(appjsonDir, file), 'utf8'));
        return {
          name: file.replace('.json', ''),
          path: content.path,
          type: content.type,
          title: content.config?.title || 'Untitled'
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: pages }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/pages/:pageName - Get specific page config
  if (req.url.startsWith('/api/pages/') && req.method === 'GET') {
    try {
      const pageName = req.url.split('/api/pages/')[1].split('?')[0];
      const filePath = path.join(appjsonDir, `${pageName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(appjsonDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Page not found' }));
        return true;
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/pages - Create new page config
  if (req.url === '/api/pages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileName = data.path.replace(/^\//, '').replace(/\//g, '-') || 'page';
        const filePath = path.join(appjsonDir, `${fileName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(appjsonDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Page created', file: `${fileName}.json` }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // PUT /api/pages/:pageName - Update page config
  if (req.url.startsWith('/api/pages/') && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const pageName = req.url.split('/api/pages/')[1].split('?')[0];
        const filePath = path.join(appjsonDir, `${pageName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(appjsonDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        const data = JSON.parse(body);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Page updated' }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // DELETE /api/pages/:pageName - Delete page config
  if (req.url.startsWith('/api/pages/') && req.method === 'DELETE') {
    try {
      const pageName = req.url.split('/api/pages/')[1].split('?')[0];
      const filePath = path.join(appjsonDir, `${pageName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(appjsonDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Page not found' }));
        return true;
      }
      
      fs.unlinkSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Page deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  return false; // Not an API route
}

// ============================================
// Dynamic CRUD API Routes (from database)
// /api/:resource - list, create
// /api/:resource/:id - get, update, delete
// ============================================
function handleCrudRoutes(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];
  const queryString = urlParts[1] || '';

  // Parse query params
  const query = {};
  queryString.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  // Match /api/:resource or /api/:resource/:id
  const match = pathname.match(/^\/api\/([a-zA-Z_][a-zA-Z0-9_]*)(?:\/([^/]+))?$/);
  if (!match) return false;

  const resource = match[1];
  const id = match[2] || null;

  // Skip reserved API paths (schema, pages, auth)
  const reserved = ['schema', 'pages', 'auth'];
  if (reserved.includes(resource)) return false;

  // Check if this resource has a schema/table
  const tableNames = database.getTableNames();
  if (!tableNames.includes(resource)) return false;

  // Set JSON header helper
  const json = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/:resource - List with pagination & search
  if (!id && req.method === 'GET') {
    try {
      const schema = database.getSchema(resource);
      const searchFields = schema ? schema.fields
        .filter(f => ['text', 'email', 'textarea', 'url', 'enum'].includes(f.type))
        .map(f => f.name) : [];

      const result = database.list(resource, {
        page: parseInt(query.page) || 1,
        perPage: parseInt(query.perPage) || parseInt(query.per_page) || 10,
        search: query.search || '',
        searchFields,
        sort: query.sort || '',
        order: query.order || 'asc'
      });

      json(200, { success: true, ...result });
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  // GET /api/:resource/:id - Get single record
  if (id && req.method === 'GET') {
    try {
      const row = database.getById(resource, id);
      if (!row) {
        json(404, { success: false, error: `${resource} not found` });
      } else {
        json(200, { success: true, data: row });
      }
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  // POST /api/:resource - Create new record
  if (!id && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        // Bulk delete action
        if (data._action === 'bulkDelete' && Array.isArray(data.ids)) {
          const deleted = database.bulkDelete(resource, data.ids);
          json(200, { success: true, deleted });
          return;
        }

        const created = database.create(resource, data);
        json(201, { success: true, data: created });
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    });
    return true;
  }

  // PUT /api/:resource/:id - Update record
  if (id && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const updated = database.update(resource, id, data);
        if (!updated) {
          json(404, { success: false, error: `${resource} not found` });
        } else {
          json(200, { success: true, data: updated });
        }
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    });
    return true;
  }

  // DELETE /api/:resource/:id - Delete record
  if (id && req.method === 'DELETE') {
    try {
      const deleted = database.remove(resource, id);
      if (!deleted) {
        json(404, { success: false, error: `${resource} not found` });
      } else {
        json(200, { success: true, message: `${resource} deleted` });
      }
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle config API routes first (schema, pages)
  if (handleApiRoutes(req, res)) {
    return;
  }

  // Handle dynamic CRUD routes (database)
  if (handleCrudRoutes(req, res)) {
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Strip query string for file path resolution
  filePath = filePath.split('?')[0];
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Server Error</h1>');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Initialize database before starting server
database.init();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET    /api/schema         - List all schemas`);
  console.log(`  GET    /api/schema/:name   - Get schema config`);
  console.log(`  POST   /api/schema         - Create schema`);
  console.log(`  PUT    /api/schema/:name   - Update schema`);
  console.log(`  DELETE /api/schema/:name   - Delete schema`);
  console.log(`  GET    /api/pages          - List all pages`);
  console.log(`  GET    /api/pages/:name    - Get page config`);
  console.log(`  POST   /api/pages          - Create page`);
  console.log(`  PUT    /api/pages/:name    - Update page`);
  console.log(`  DELETE /api/pages/:name    - Delete page`);
  console.log(`  --- Dynamic CRUD (from schema) ---`);
  const tables = database.getTableNames();
  tables.forEach(t => {
    console.log(`  CRUD   /api/${t}           - ${t} (list, create, get, update, delete)`);
  });
});
