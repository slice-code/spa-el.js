(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.CrudEngine = factory());
})(this, (function () {
  'use strict';

  const CrudEngine = {
    // Build complete CRUD UI from JSON schema
    build(schema, options = {}) {
      const {
        apiClient = null,
        container = null,
        permissions = null
      } = options;

      const resource = schema.resource;
      let tableInstance = null;
      let currentPermissions = permissions || {};
      let lastPage = 1;
      let lastPerPage = parseInt(localStorage.getItem(`crud_perPage_${schema.resource}`)) || schema.table?.features?.perPage || 10;
      let lastSearch = null;

      // Check permissions
      const canCreate = this.checkPermission('create', schema.permissions, currentPermissions);
      const canRead = this.checkPermission('read', schema.permissions, currentPermissions);
      const canUpdate = this.checkPermission('update', schema.permissions, currentPermissions);
      const canDelete = this.checkPermission('delete', schema.permissions, currentPermissions);

      // Container - full height flex column
      const crudContainer = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'hidden'
      });

      // Header bar: title + search + create button (responsive)
      const header = el('div').css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        flexShrink: '0',
        position: 'relative',
        zIndex: '10'
      });

      // Title (left side)
      const titleEl = el('h2')
        .text(schema.title || 'CRUD')
        .css({
          margin: '0',
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#111827',
          whiteSpace: 'nowrap',
          flexShrink: '0'
        });
      header.child(titleEl);

      // Search input (middle, pushes button to right)
      const searchInput = el('input')
        .attr('type', 'text')
        .attr('placeholder', 'Search...')
        .css({
          flex: '1',
          minWidth: '200px',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.875rem',
          outline: 'none'
        });
      header.child(searchInput);

      // Create button (right side)
      if (canCreate) {
        const createButton = el('button')
          .css({
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            flexShrink: '0'
          });

        createButton.child(el('i').class('fas fa-plus'));
        createButton.child(el('span').text('Create New'));
        
        createButton.click(() => {
          this.openCreateModal(schema, apiClient, tableInstance, refreshTable);
        });

        header.child(createButton);
      }

      crudContainer.child(header);

      // Refresh function that preserves current pagination state
      const refreshTable = () => {
        this.loadData(schema, apiClient, tableInstance, lastSearch, null, null, lastPage, lastPerPage);
      };

      // Prepare table columns with actions
      const tableSchema = {
        ...schema.table,
        columns: schema.table.columns.map(col => {
          if (col.type === 'actions') {
            const actions = [];
            
            if (col.actions) {
              col.actions.forEach(action => {
                if (action === 'edit' && canUpdate) {
                  actions.push({
                    icon: 'fas fa-edit',
                    label: 'Edit',
                    onClick: (row) => this.openEditModal(schema, apiClient, tableInstance, row, refreshTable)
                  });
                } else if (action === 'delete' && canDelete) {
                  actions.push({
                    icon: 'fas fa-trash',
                    label: 'Delete',
                    variant: 'danger',
                    confirm: true,
                    onClick: (row) => this.deleteRow(schema, apiClient, tableInstance, row, refreshTable)
                  });
                } else if (typeof action === 'object') {
                  actions.push(action);
                }
              });
            }

            return {
              ...col,
              actions: actions
            };
          }
          return col;
        })
      };

      // Build table (search disabled - handled by CRUD header)
      const tableSchemaNoSearch = { ...tableSchema, features: { ...tableSchema.features, search: false, perPage: lastPerPage } };
      tableInstance = TableBuilder.build(tableSchemaNoSearch, {
        data: [],
        onSearch: (query) => {
          lastSearch = query;
          lastPage = 1;
          this.loadData(schema, apiClient, tableInstance, query, null, null, 1, lastPerPage);
        },
        onSort: (column, direction) => {
          this.loadData(schema, apiClient, tableInstance, lastSearch, column, direction, lastPage, lastPerPage);
        },
        onPageChange: (page) => {
          lastPage = page;
          this.loadData(schema, apiClient, tableInstance, lastSearch, null, null, page, lastPerPage);
        },
        onPerPageChange: (newPerPage, page) => {
          lastPerPage = newPerPage;
          lastPage = page;
          localStorage.setItem(`crud_perPage_${schema.resource}`, newPerPage);
          this.loadData(schema, apiClient, tableInstance, lastSearch, null, null, page, newPerPage);
        }
      });

      // Wire search input from header to table (with debounce for server-side search)
      let searchTimeout = null;
      searchInput.on('input', (e) => {
        const query = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          lastSearch = query;
          lastPage = 1;
          this.loadData(schema, apiClient, tableInstance, query, null, null, 1, lastPerPage);
        }, 400);
      });

      // Table goes directly in container (table-builder handles its own scroll)
      crudContainer.child(tableInstance.el);

      // Load initial data
      if (canRead && apiClient) {
        this.loadData(schema, apiClient, tableInstance, lastSearch, null, null, lastPage, lastPerPage);
      }

      return {
        el: crudContainer,
        get: () => crudContainer.get(),
        table: tableInstance,
        loadData: refreshTable,
        openCreateModal: () => this.openCreateModal(schema, apiClient, tableInstance, refreshTable),
        openEditModal: (row) => this.openEditModal(schema, apiClient, tableInstance, row, refreshTable),
        deleteRow: (row) => this.deleteRow(schema, apiClient, tableInstance, row, refreshTable),
        setPermissions: (perms) => {
          currentPermissions = perms;
        },
        refresh: refreshTable
      };
    },

    // Load data from API
    async loadData(schema, apiClient, tableInstance, search = null, sortColumn = null, sortDirection = null, page = 1, perPageOverride = null) {
      if (!apiClient || !tableInstance) return;

      tableInstance.setLoading(true);

      try {
        const resource = schema.resource;
        let endpoint = resource;

        // Build query parameters
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (sortColumn) params.set('sort', sortColumn);
        if (sortDirection) params.set('order', sortDirection);
        params.set('page', page);
        params.set('perPage', perPageOverride || schema.table.features?.perPage || 10);

        const queryString = params.toString();
        if (queryString) {
          endpoint = `${resource}?${queryString}`;
        }

        const response = await apiClient.read(endpoint);
        
        // Handle different response formats
        let data = [];
        if (Array.isArray(response)) {
          data = response;
        } else if (response.data && Array.isArray(response.data)) {
          data = response.data;
        } else if (response.items && Array.isArray(response.items)) {
          data = response.items;
        }

        // Pass server pagination info if available
        const serverPagination = response.pagination || null;
        tableInstance.setData(data, serverPagination);
      } catch (error) {
        console.error('Error loading data:', error);
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    },

    // Open create modal or new page
    openCreateModal(schema, apiClient, tableInstance, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      const formDisplay = schema.formDisplay || 'modal'; // 'modal' or 'newpage'

      if (formDisplay === 'newpage') {
        this.openCreateAsNewPage(schema, apiClient, tableInstance, refreshTable);
      } else {
        this.openCreateAsModal(schema, apiClient, tableInstance, refreshTable);
      }
    },

    // Open create form as modal
    openCreateAsModal(schema, apiClient, tableInstance, refreshTable) {
      // Add hideButtons to form schema so buttons only appear in footer
      const formSchema = {
        ...schema.form,
        hideButtons: true
      };

      const form = FormBuilder.build(formSchema, {
        onSubmit: async (formData) => {
          try {
            await apiClient.create(schema.resource, formData);
            
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Data created successfully', { type: 'success' });
            }
            
            layout.closeModal();
            refreshTable();
          } catch (error) {
            console.error('Error creating data:', error);
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Error creating data', { type: 'error' });
            }
          }
        }
      });

      if (typeof layout !== 'undefined' && layout.modal) {
        layout.modal({
          title: `Create ${schema.title || 'New Item'}`,
          content: form.el,
          footer: this.createModalFooter(schema, apiClient, tableInstance, null, 'create'),
          dismissible: true,
          size: schema.modalSize || 'medium' // 'small', 'medium', 'large', 'full'
        });
      }
    },

    // Open create form as new page
    openCreateAsNewPage(schema, apiClient, tableInstance, refreshTable) {
      const formPagePath = `${schema.resource}/create`;
      const listPath = schema.path || `/${schema.resource}`; // Store list path for navigation
      
      const form = FormBuilder.build(schema.form, {
        onSubmit: async (formData) => {
          try {
            await apiClient.create(schema.resource, formData);
            
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Data created successfully', { type: 'success' });
            }
            
            // Navigate back to list page
            layout.navigate(listPath);
            refreshTable();
          } catch (error) {
            console.error('Error creating data:', error);
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Error creating data', { type: 'error' });
            }
          }
        },
        onCancel: () => {
          layout.navigate(listPath);
        }
      });

      if (typeof layout !== 'undefined') {
        layout.addPage({
          path: formPagePath,
          component: () => {
            const pageContainer = el('div').css({
              width: '100%',
              padding: '2rem',
              boxSizing: 'border-box'
            });
            
            pageContainer.child(
              el('h1').css({ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' })
                .text(`Create ${schema.title || 'New Item'}`)
            );
            
            // Wrap form in card with full width
            const card = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%',
              boxSizing: 'border-box'
            });
            card.child(form.el.css({ width: '100%' }));
            pageContainer.child(card);
            
            return pageContainer.get();
          },
          hideLayout: false
        });
        
        layout.navigate(formPagePath);
      }
    },

    // Open edit modal or new page
    openEditModal(schema, apiClient, tableInstance, row, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      const formDisplay = schema.formDisplay || 'modal';

      if (formDisplay === 'newpage') {
        this.openEditAsNewPage(schema, apiClient, tableInstance, row, refreshTable);
      } else {
        this.openEditAsModal(schema, apiClient, tableInstance, row, refreshTable);
      }
    },

    // Open edit form as modal
    openEditAsModal(schema, apiClient, tableInstance, row, refreshTable) {
      // Add hideButtons to form schema so buttons only appear in footer
      const formSchema = {
        ...schema.form,
        hideButtons: true
      };

      const form = FormBuilder.build(formSchema, {
        initialData: row,
        onSubmit: async (formData) => {
          try {
            const id = row.id || row._id;
            await apiClient.update(`${schema.resource}/${id}`, formData);
            
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Data updated successfully', { type: 'success' });
            }
            
            layout.closeModal();
            refreshTable();
          } catch (error) {
            console.error('Error updating data:', error);
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Error updating data', { type: 'error' });
            }
          }
        }
      });

      if (typeof layout !== 'undefined' && layout.modal) {
        layout.modal({
          title: `Edit ${schema.title || 'Item'}`,
          content: form.el,
          footer: this.createModalFooter(schema, apiClient, tableInstance, row, 'edit'),
          dismissible: true,
          size: schema.modalSize || 'medium'
        });
      }
    },

    // Open edit form as new page
    openEditAsNewPage(schema, apiClient, tableInstance, row, refreshTable) {
      const id = row.id || row._id;
      const formPagePath = `${schema.resource}/edit/${id}`;
      const listPath = schema.path || `/${schema.resource}`; // Store list path for navigation
      
      const form = FormBuilder.build(schema.form, {
        initialData: row,
        onSubmit: async (formData) => {
          try {
            await apiClient.update(`${schema.resource}/${id}`, formData);
            
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Data updated successfully', { type: 'success' });
            }
            
            layout.navigate(listPath);
            refreshTable();
          } catch (error) {
            console.error('Error updating data:', error);
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Error updating data', { type: 'error' });
            }
          }
        },
        onCancel: () => {
          layout.navigate(listPath);
        }
      });

      if (typeof layout !== 'undefined') {
        layout.addPage({
          path: formPagePath,
          component: () => {
            const pageContainer = el('div').css({
              width: '100%',
              padding: '2rem',
              boxSizing: 'border-box'
            });
            
            pageContainer.child(
              el('h1').css({ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' })
                .text(`Edit ${schema.title || 'Item'}`)
            );
            
            // Wrap form in card with full width
            const card = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%',
              boxSizing: 'border-box'
            });
            card.child(form.el.css({ width: '100%' }));
            pageContainer.child(card);
            
            return pageContainer.get();
          },
          hideLayout: false
        });
        
        layout.navigate(formPagePath);
      }
    },

    // Delete row
    async deleteRow(schema, apiClient, tableInstance, row, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      if (typeof layout !== 'undefined' && layout.confirm) {
        layout.confirm({
          title: 'Delete Confirmation',
          message: `Are you sure you want to delete this ${schema.title?.toLowerCase() || 'item'}?`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: async () => {
            try {
              const id = row.id || row._id;
              await apiClient.delete(`${schema.resource}/${id}`);
              
              if (typeof layout !== 'undefined' && layout.toast) {
                layout.toast('Data deleted successfully', { type: 'success' });
              }
              
              refreshTable();
            } catch (error) {
              console.error('Error deleting data:', error);
            }
          }
        });
      }
    },

    // Check permission
    checkPermission(action, permissions, currentPermissions) {
      if (!permissions || !permissions[action]) return true;
      if (!currentPermissions || currentPermissions.length === 0) return true;
      
      return permissions[action].some(role => currentPermissions.includes(role));
    },

    // Create modal footer with save/cancel buttons
    createModalFooter(schema, apiClient, tableInstance, row, mode) {
      const footer = el('div').css({
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb'
      });

      // Cancel button
      const cancelButton = el('button')
        .text('Cancel')
        .css({
          padding: '0.65rem 1.25rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          color: '#374151',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500'
        })
        .click(() => {
          if (typeof layout !== 'undefined') {
            layout.closeModal();
          }
        });

      // Save button
      const saveButton = el('button')
        .text(mode === 'create' ? 'Create' : 'Save')
        .css({
          padding: '0.65rem 1.25rem',
          borderRadius: '0.5rem',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500'
        })
        .click(() => {
          // Trigger form submit - find form and dispatch submit event
          const form = document.querySelector('#crud-form');
          if (form) {
            form.requestSubmit();
          }
        });

      footer.child(cancelButton);
      footer.child(saveButton);

      return footer;
    }
  };

  return CrudEngine;
}));
