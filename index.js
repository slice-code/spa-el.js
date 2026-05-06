// ============================================
// Core App - JSON-Driven UI Framework
// ============================================
// Schema:  /schema folder  → database DDL (SchemaManager)
// AppJSON: /appjson folder → UI pages & CRUD configs
// ============================================

const API_BASE = window.location.origin;

// ============================================
// Load Schemas for Database (SchemaManager only)
// ============================================
// Schema files are for database DDL generation only.
// CRUD UI pages are defined in appjson/.
async function loadSchemasForDatabase(core) {
  try {
    console.log('Loading database schemas from /api/schema...');
    
    const schemaResponse = await fetch(`${API_BASE}/api/schema`);
    const schemaResult = await schemaResponse.json();
    
    if (!schemaResult.success) {
      throw new Error(schemaResult.error || 'Failed to load schemas');
    }
    
    console.log(`Found ${schemaResult.data.length} database schemas`);
    
    for (const schemaInfo of schemaResult.data) {
      const schemaName = schemaInfo.name;
      
      const response = await fetch(`${API_BASE}/api/schema/${schemaName}`);
      const schemaData = await response.json();
      
      if (!schemaData.success) {
        console.warn(`Failed to load schema '${schemaName}': ${schemaData.error}`);
        continue;
      }
      
      const schema = schemaData.data;
      
      // Register schema in core for database reference (SchemaManager)
      core.registerSchema(schema.name, schema);
      console.log(`✓ Registered database schema: ${schema.name}`);
    }
    
  } catch (error) {
    console.error('Failed to load database schemas:', error);
  }
}

// ============================================
// Load Pages from API (appjson folder)
// ============================================
async function loadAppJsonPages(core) {
  try {
    console.log('Fetching page configurations from /api/pages...');
    
    const response = await fetch(`${API_BASE}/api/pages`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load pages');
    }
    
    console.log(`Found ${result.data.length} pages`);
    const menuItems = [];
    
    // Load each page configuration
    for (const pageInfo of result.data) {
      try {
        const pagePath = pageInfo.path;
        const pageName = pageInfo.name; // Use filename from server, not derived from path
        
        const pageResponse = await fetch(`${API_BASE}/api/pages/${pageName}`);
        const pageResult = await pageResponse.json();
        
        if (!pageResult.success) {
          console.warn(`Failed to load page ${pageInfo.path}: ${pageResult.error}`);
          continue;
        }
        
        const pageConfig = pageResult.data;
        
        console.log(`Loading page: ${pageConfig.path}, type: ${pageConfig.type}`);
        
        // Register page based on type
        if (pageConfig.type === 'crud') {
          // CRUD UI pages are defined in appjson
          const crudConfig = pageConfig.config;
          core.addCrudPage(pageConfig.path, crudConfig, pageConfig.options || {});
          
          // Collect menu item for sidebar
          menuItems.push({
            name: crudConfig.title || pageName,
            icon: crudConfig.icon || 'fas fa-table',
            page: pageConfig.path
          });
          console.log(`✓ Loaded CRUD page: ${pageConfig.path}`);
        } else if (pageConfig.type === 'page') {
          core.addPage(pageConfig.path, pageConfig.config, pageConfig.options || {});
          console.log(`✓ Loaded page: ${pageConfig.path}`);
        } else {
          console.warn(`⚠️ Unknown page type: ${pageConfig.type}`);
        }
      } catch (error) {
        console.error(`Error loading page ${pageInfo.path}:`, error);
      }
    }
    
    return menuItems;
    
  } catch (error) {
    console.error('Failed to load page configurations:', error);
    return [];
  }
}

// ============================================
// Load Menu from API
// ============================================
async function loadMenuConfig(core) {
  try {
    console.log('Loading menu configuration from /api/menu...');
    const response = await fetch(`${API_BASE}/api/menu`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load menu config');
    }
    
    const menuConfig = result.data;
    
    // Update core with menu configuration
    if (menuConfig.sideMenu) {
      core.layoutConfig.sideMenu = menuConfig.sideMenu;
    }
    if (menuConfig.navbar) {
      core.layoutConfig.navbar = menuConfig.navbar;
    }
    if (menuConfig.theme) {
      core.layoutConfig.theme = menuConfig.theme;
    }
    if (menuConfig.navbarTitle) {
      core.layoutConfig.navbarTitle = menuConfig.navbarTitle;
    }
    
    console.log('✓ Menu configuration loaded');
    return menuConfig;
  } catch (error) {
    console.warn('Failed to load menu config, using defaults:', error);
    return null;
  }
}

// ============================================
// Main App Initialization
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  
  console.log('Loading Core App...');
  
  // Initialize Core App with placeholder menus
  const core = new CoreApp({
    api: {
      baseUrl: `${API_BASE}/api`,
      token: () => localStorage.getItem('token')
    },
    layout: {
      theme: 'blue',
      sideMenu: [],
      navbar: []
    }
  });
  
  // ============================================
  // 0. Load Menu Configuration (before pages)
  // ============================================
  await loadMenuConfig(core);
  
  // ============================================
  // 1. Load Database Schemas (for SchemaManager/DDL only)
  // ============================================
  await loadSchemasForDatabase(core);
  
  // ============================================
  // 2. Load All Pages from appjson (both CRUD and regular pages)
  // ============================================
  const crudMenuItems = await loadAppJsonPages(core);
  
  // Update Data Management menu with CRUD items from appjson
  const dataMgmtItem = core.layoutConfig.sideMenu.find(item => item.name === 'Data Management');
  if (dataMgmtItem && crudMenuItems.length > 0) {
    dataMgmtItem.children = crudMenuItems;
  }
  
  // ============================================
  // 3. Load Hardcoded Pages
  // ============================================
  loadHardcodedPages(core);

  // ============================================
  // 4. Initialize App
  // ============================================
  console.log('Starting Core App...');
  core.init();
  
  // Set navbar title from menu config
  if (core.layoutConfig.navbarTitle) {
    layout.setNavbarTitle(core.layoutConfig.navbarTitle);
  }
  
  console.log('✅ Core App initialized successfully!');
});

// ============================================
// Hardcoded Pages (special pages)
// ============================================
function loadHardcodedPages(core) {
  
  // Contact Page
  core.addPage('/contact', {
    type: 'page',
    title: 'Contact Us',
    children: [
      {
        type: 'card',
        children: [
          { type: 'heading', level: 2, text: 'Get in Touch' },
          { type: 'text', text: 'Have questions? Send us a message.' },
          {
            type: 'form',
            fields: [
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'message', label: 'Message', type: 'textarea', required: true, rows: 5 }
            ],
            submitText: 'Send Message',
            onSubmit: (data) => {
              core.toast('Message sent!', { type: 'success', title: 'Contact' });
              console.log('Form data:', data);
            }
          }
        ]
      }
    ]
  });

  // Full Width Page
  core.addPage('/full', {
    type: 'page',
    title: 'Full Width Desktop Mode',
    children: [
      { type: 'card', padding: '2rem', children: [
        { type: 'heading', level: 2, text: 'Full Width Desktop Mode', fontSize: '2rem' },
        { type: 'text', text: 'This page demonstrates a full-width desktop layout.' }
      ]}
    ]
  }, { fullWidthDesktop: true });

  // Login Page
  core.addPage('/login', {
    type: 'custom',
    render: () => {
      return el('div').css({ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '1rem' }).child([
        el('div').css({ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '18px', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)', backgroundColor: '#ffffff' }).child([
          el('div').css({ marginBottom: '1.5rem' }).child([
            el('h2').text('Welcome Back').css({ margin: '0 0 0.5rem', fontSize: '1.85rem', fontWeight: '800' }),
            el('p').text('Sign in to your account.').css({ margin: 0, lineHeight: '1.75', color: '#475569' }),
          ]),
          el('div').css({ display: 'grid', gap: '1rem' }).child([
            el('input').attr('type', 'text').attr('placeholder', 'Email Address').css({ width: '100%', padding: '0.95rem', borderRadius: '0.85rem', border: '1px solid #cbd5e1' }),
            el('input').attr('type', 'password').attr('placeholder', 'Password').css({ width: '100%', padding: '0.95rem', borderRadius: '0.85rem', border: '1px solid #cbd5e1' }),
            el('button').text('Sign In').css({ width: '100%', padding: '0.95rem', borderRadius: '0.85rem', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '700', cursor: 'pointer' }).click(() => {
              core.toast('Logged in successfully', { type: 'success', title: 'Login' });
              core.navigate('/');
            }),
          ]),
        ])
      ]);
    }
  }, { hideLayout: true });
}