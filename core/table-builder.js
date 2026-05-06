(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TableBuilder = factory());
})(this, (function () {
  'use strict';

  const TableBuilder = {
    // Build table from JSON schema
    build(schema, options = {}) {
      const {
        data = [],
        onDataChange = () => {},
        onPageChange = () => {},
        onPerPageChange = () => {},
        onSort = () => {},
        onSearch = () => {},
        onSelectionChange = () => {}
      } = options;

      let tableData = [...data];
      let currentPage = 1;
      let perPage = schema.features?.perPage || 10;
      let sortColumn = null;
      let sortDirection = 'asc';
      let searchQuery = '';
      let selectedRows = new Set();
      let isLoading = false;

      // Table container
      const container = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'hidden'
      });

      // Search bar
      let searchInput = null;
      if (schema.features?.search) {
        const searchContainer = el('div').css({
          display: 'flex',
          gap: '0.5rem'
        });

        searchInput = el('input')
          .attr('type', 'text')
          .attr('placeholder', 'Search...')
          .css({
            flex: '1',
            padding: '0.65rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1d5db',
            fontSize: '0.95rem',
            outline: 'none'
          })
          .on('input', (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            onSearch(searchQuery);
            this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          });

        searchContainer.child(searchInput);
        container.child(searchContainer);
      }

      // Table wrapper (only tbody scrolls, thead stays fixed via sticky)
      const tableWrapper = el('div').css({
        overflowY: 'auto',
        overflowX: 'auto',
        flex: '1',
        minHeight: '0',
        position: 'relative'
      });

      // Table element
      const table = el('table').css({
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.95rem'
      });

      // Table header (sticky - stays fixed while body scrolls)
      const thead = el('thead').css({
        backgroundColor: '#f9fafb',
        borderBottom: '2px solid #e5e7eb',
        position: 'sticky',
        top: '0',
        zIndex: '2',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      });

      const headerRow = el('tr');

      // Selection checkbox column
      if (schema.features?.selectable) {
        headerRow.child(
          el('th').css({
            padding: '0.75rem',
            textAlign: 'left',
            fontWeight: '600',
            width: '50px',
            backgroundColor: '#f9fafb'
          }).child(
            el('input')
              .attr('type', 'checkbox')
              .css({ width: '1rem', height: '1rem', cursor: 'pointer' })
              .on('change', (e) => {
                if (e.target.checked) {
                  filteredData().forEach((row, idx) => selectedRows.add(idx));
                } else {
                  selectedRows.clear();
                }
                onSelectionChange(Array.from(selectedRows).map(idx => filteredData()[idx]));
                this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
              })
          )
        );
      }

      // Data columns
      schema.columns.forEach(column => {
        const th = el('th').css({
          padding: '0.75rem',
          textAlign: 'left',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          cursor: column.sortable ? 'pointer' : 'default',
          backgroundColor: '#f9fafb'
        }).text(column.label || '');

        if (column.sortable && schema.features?.sortable) {
          const sortIcon = el('i').css({ marginLeft: '0.25rem', fontSize: '0.75rem' });
          th.child(sortIcon);

          th.click(() => {
            if (sortColumn === column.key) {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              sortColumn = column.key;
              sortDirection = 'asc';
            }
            onSort(sortColumn, sortDirection);
            this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          });
        }

        headerRow.child(th);
      });

      thead.child(headerRow);
      table.child(thead);

      // Table body
      const tbody = el('tbody');
      table.child(tbody);
      tableWrapper.child(table);

      // Pagination (above table)
      let paginationContainer = null;
      let handlePageChange = null;
      let loadingSpinner = null;
      if (schema.features?.pagination) {
        paginationContainer = el('div').css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#fafafa',
          flexShrink: '0',
          fontSize: '0.813rem',
          color: '#6b7280',
          position: 'relative',
          zIndex: '5'
        });

        // Per page selector
        const perPageContainer = el('div').css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        });

        perPageContainer.child(el('span').text('Show'));
        
        const perPageSelect = el('select')
          .css({
            padding: '0.25rem 0.4rem',
            borderRadius: '0.25rem',
            border: '1px solid #d1d5db',
            fontSize: '0.813rem',
            outline: 'none'
          });

        const perPageOptions = schema.features?.perPageOptions || [5, 10, 25, 50, 100];
        perPageOptions.forEach(option => {
          const opt = el('option')
            .attr('value', option)
            .text(option);
          if (option === perPage) {
            opt.attr('selected', 'selected');
          }
          perPageSelect.child(opt);
        });

        perPageSelect.on('change', (e) => {
          perPage = parseInt(e.target.value);
          currentPage = 1;
          onPerPageChange(perPage, currentPage);
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          this.renderPagination(paginationContainer, schema, filteredData().length, currentPage, perPage, handlePageChange);
        });

        perPageContainer.child(perPageSelect);
        perPageContainer.child(el('span').text('entries'));

        // Ensure select shows correct value
        perPageSelect.el.value = perPage;
        paginationContainer.child(perPageContainer);

        // Loading spinner (shown next to pagination info)
        loadingSpinner = el('div').css({
          display: 'none',
          width: '12px',
          height: '12px',
          border: '2px solid #e5e7eb',
          borderTop: '2px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
          flexShrink: '0'
        });
        paginationContainer.child(loadingSpinner);

        // Page change handler
        handlePageChange = (page) => {
          currentPage = page;
          onPageChange(page);
        };

        // Pagination buttons
        const paginationButtons = this.createPaginationButtons(
          schema,
          filteredData().length,
          currentPage,
          perPage,
          handlePageChange
        );

        paginationContainer.child(paginationButtons);
        container.child(paginationContainer);
      }

      // Table wrapper after pagination
      container.child(tableWrapper);

      // Bulk actions
      let bulkActionsContainer = null;
      if (schema.features?.selectable && schema.features?.bulkActions?.length > 0) {
        bulkActionsContainer = el('div').css({
          display: 'none',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.5rem',
          border: '1px solid #bae6fd'
        });

        schema.features.bulkActions.forEach(action => {
          const button = el('button')
            .text(action.label)
            .css({
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #0284c7',
              backgroundColor: '#fff',
              color: '#0284c7',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            });

          if (action.icon) {
            button.child(el('i').class(action.icon));
          }

          button.click(() => {
            const selected = Array.from(selectedRows).map(idx => filteredData()[idx]);
            action.onClick(selected);
          });

          bulkActionsContainer.child(button);
        });

        container.child(bulkActionsContainer);
      }

      // Initial render
      this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
      
      if (paginationContainer) {
        this.renderPagination(paginationContainer, schema, filteredData().length, currentPage, perPage, handlePageChange);
      }

      // Helper function to filter and sort data
      function filteredData() {
        let filtered = [...tableData];

        // Apply search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(row => {
            return schema.columns.some(column => {
              if (column.type === 'actions') return false;
              const value = row[column.key];
              return value && String(value).toLowerCase().includes(query);
            });
          });
        }

        // Apply sort
        if (sortColumn) {
          filtered.sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
          });
        }

        return filtered;
      }

      // Return table API
      return {
        el: container,
        get: () => container.get(),
        setData: (newData, serverPagination) => {
          tableData = [...newData];
          if (serverPagination) {
            // Server-side pagination: use server's page info
            currentPage = serverPagination.page || 1;
            perPage = serverPagination.perPage || perPage;
          } else {
            currentPage = 1;
          }
          selectedRows.clear();
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows, serverPagination);
          if (paginationContainer) {
            const totalItems = serverPagination ? serverPagination.total : filteredData().length;
            this.renderPagination(paginationContainer, schema, totalItems, currentPage, perPage, handlePageChange);
          }
          onDataChange(tableData);
        },
        getData: () => [...tableData],
        getSelectedRows: () => Array.from(selectedRows).map(idx => filteredData()[idx]),
        setLoading: (loading) => {
          isLoading = loading;
          if (loading) {
            // Dim table and show spinner
            tbody.css({ opacity: '0.5', pointerEvents: 'none', transition: 'opacity 0.15s' });
            if (loadingSpinner) loadingSpinner.css({ display: 'block' });
          } else {
            tbody.css({ opacity: '1', pointerEvents: 'auto', transition: 'opacity 0.15s' });
            if (loadingSpinner) loadingSpinner.css({ display: 'none' });
          }
        },
        refresh: () => {
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
        },
        resetSelection: () => {
          selectedRows.clear();
          onSelectionChange([]);
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
        }
      };
    },

    // Render table body
    renderTableBody(tbody, schema, data, page, perPage, selectedRows, serverPagination) {
      // Clear the existing tbody
      tbody.empty();

      if (data.length === 0) {
        tbody.child(
          el('tr').child(
            el('td')
              .attr('colspan', schema.columns.length)
              .css({
                textAlign: 'center',
                padding: '2rem',
                color: '#6b7280'
              })
              .text(schema.emptyText || 'No data available')
          )
        ).get();
        return;
      }

      // Paginate (skip if server already paginated)
      let pageData;
      let startIdx;
      if (serverPagination) {
        pageData = data;
        startIdx = 0;
      } else {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        pageData = data.slice(start, end);
        startIdx = start;
      }

      pageData.forEach((row, idx) => {
        const globalIdx = startIdx + idx;
        const tr = el('tr').css({
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: selectedRows.has(globalIdx) ? '#f0f9ff' : 'transparent',
          transition: 'background-color 0.2s'
        }).hover(
          function() { this.style.backgroundColor = '#f9fafb'; },
          function() { 
            this.style.backgroundColor = selectedRows.has(globalIdx) ? '#f0f9ff' : 'transparent'; 
          }
        );

        // Selection checkbox
        if (schema.features?.selectable) {
          tr.child(
            el('td').css({ padding: '0.75rem' }).child(
              el('input')
                .attr('type', 'checkbox')
                .attr('checked', selectedRows.has(globalIdx) ? 'checked' : null)
                .css({ width: '1rem', height: '1rem', cursor: 'pointer' })
                .on('change', (e) => {
                  if (e.target.checked) {
                    selectedRows.add(globalIdx);
                  } else {
                    selectedRows.delete(globalIdx);
                  }
                })
            )
          );
        }

        // Data cells
        schema.columns.forEach(column => {
          const td = el('td').css({ padding: '0.75rem' });

          if (column.type === 'actions') {
            const actionsContainer = el('div').css({
              display: 'flex',
              gap: '0.5rem'
            });

            const actions = column.actions || [];
            actions.forEach(action => {
              const button = el('button')
                .css({
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: action.variant === 'danger' ? '#fee2e2' : '#f0f9ff',
                  color: action.variant === 'danger' ? '#dc2626' : '#0284c7',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                });

              if (action.icon) {
                button.child(el('i').class(action.icon));
              }
              button.child(el('span').text(action.label));

              button.click(() => {
                if (action.confirm) {
                  if (typeof layout !== 'undefined' && layout.confirm) {
                    layout.confirm({
                      title: 'Confirm',
                      message: `Are you sure you want to ${action.label.toLowerCase()}?`,
                      onConfirm: () => action.onClick(row)
                    });
                  } else {
                    action.onClick(row);
                  }
                } else {
                  action.onClick(row);
                }
              });

              actionsContainer.child(button);
            });

            td.child(actionsContainer);
          } else if (column.render) {
            td.html(column.render(row[column.key], row));
          } else {
            td.text(row[column.key] ?? '');
          }

          tr.child(td);
        });

        tbody.child(tr);
      });

      // Flush buffered children to DOM
      tbody.get();
    },

    // Create pagination buttons
    createPaginationButtons(schema, totalItems, currentPage, perPage, onPageChange) {
      const container = el('div').css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
      });

      const totalPages = Math.ceil(totalItems / perPage);

      // Info text
      container.child(
        el('span')
          .css({ fontSize: '0.813rem', color: '#6b7280', marginRight: '0.5rem' })
          .text(`${currentPage} / ${totalPages || 1} (${totalItems})`)
      );

      // Previous button
      const prevButton = el('button')
        .text('‹')
        .css({
          padding: '0.2rem 0.5rem',
          borderRadius: '0.25rem',
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          color: currentPage === 1 ? '#9ca3af' : '#374151',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          fontSize: '0.813rem',
          lineHeight: '1'
        });
      if (currentPage === 1) prevButton.attr('disabled', true);
      prevButton.click(() => {
        if (currentPage > 1) onPageChange(currentPage - 1);
      });

      container.child(prevButton);

      // Page numbers
      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);

      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      if (startPage > 1) {
        container.child(this.createPageButton(1, currentPage, onPageChange));
        if (startPage > 2) {
          container.child(el('span').text('...').css({ color: '#6b7280' }));
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        container.child(this.createPageButton(i, currentPage, onPageChange));
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          container.child(el('span').text('...').css({ color: '#6b7280' }));
        }
        container.child(this.createPageButton(totalPages, currentPage, onPageChange));
      }

      // Next button
      const nextButton = el('button')
        .text('›')
        .css({
          padding: '0.2rem 0.5rem',
          borderRadius: '0.25rem',
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          color: currentPage === totalPages || totalPages === 0 ? '#9ca3af' : '#374151',
          cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
          fontSize: '0.813rem',
          lineHeight: '1'
        });
      if (currentPage === totalPages || totalPages === 0) nextButton.attr('disabled', true);
      nextButton.click(() => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
      });

      container.child(nextButton);

      return container;
    },

    // Create single page button
    createPageButton(page, currentPage, onPageChange) {
      return el('button')
        .text(page)
        .css({
          padding: '0.2rem 0.45rem',
          borderRadius: '0.25rem',
          border: '1px solid',
          borderColor: page === currentPage ? '#2563eb' : '#d1d5db',
          backgroundColor: page === currentPage ? '#2563eb' : '#fff',
          color: page === currentPage ? '#fff' : '#374151',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: page === currentPage ? '600' : '400',
          lineHeight: '1',
          minWidth: '1.5rem',
          textAlign: 'center'
        })
        .click(() => {
          if (page !== currentPage) {
            onPageChange(page);
          }
        });
    },

    // Render pagination
    renderPagination(container, schema, totalItems, currentPage, perPage, onPageChange) {
      // Remove old pagination buttons (keep per-page selector = first child)
      const children = container.el.children;
      // Remove all children except the first one (perPageContainer)
      while (children.length > 1) {
        children[children.length - 1].remove();
      }

      // Create new pagination
      const pagination = this.createPaginationButtons(
        schema,
        totalItems,
        currentPage,
        perPage,
        onPageChange || (() => {})
      );

      container.ch = [];
      container.child(pagination);
      container.get();
    }
  };

  return TableBuilder;
}));
