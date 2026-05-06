(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.FormBuilder = factory());
})(this, (function () {
  'use strict';

  const FormBuilder = {
    // Build form from JSON schema
    build(schema, options = {}) {
      const {
        onSubmit = () => {},
        onCancel = () => {},
        initialData = {},
        readOnly = false,
        apiClient = null
      } = options;

      const formData = { ...initialData };
      const fieldElements = {};
      const errorElements = {};
      let isSubmitting = false;

      // Create form container
      const formContainer = el('form')
        .attr('id', 'crud-form') // Add ID for modal footer to trigger submit
        .css({
          display: 'flex',
          flexDirection: schema.layout === 'horizontal' ? 'row' : 'column',
          gap: schema.layout === 'grid' ? '0' : '1rem',
          flexWrap: schema.layout === 'grid' ? 'wrap' : 'nowrap'
        });

      // Create fields container with grid support
      const columns = schema.columns || 1;
      const fieldsContainer = el('div').css({
        display: 'grid',
        gridTemplateColumns: columns > 1 ? `repeat(${columns}, 1fr)` : '1fr',
        gap: schema.gap || '1rem',
        width: '100%'
      });

      schema.fields.forEach(field => {
        const fieldWrapper = this.createField(field, formData, fieldElements, errorElements, readOnly);
        
        // Support field colspan (span multiple columns)
        if (field.colspan) {
          fieldWrapper.css({ gridColumn: `span ${field.colspan}` });
        }
        
        fieldsContainer.child(fieldWrapper);
      });

      formContainer.child(fieldsContainer);

      // Create buttons (hide if using modal footer)
      let submitButton = null;
      if (!readOnly && !schema.hideButtons) {
        const buttonsContainer = el('div').css({
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb'
        });

        // Cancel button
        if (schema.cancelText !== false) {
          const cancelButton = el('button')
            .type('button')
            .text(schema.cancelText || 'Cancel')
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
            .click((e) => {
              e.preventDefault();
              onCancel();
            });
          buttonsContainer.child(cancelButton);
        }

        // Submit button
        submitButton = el('button')
          .type('submit')
          .text(schema.submitText || 'Submit')
          .css({
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            opacity: '1',
            transition: 'opacity 0.2s'
          });

        buttonsContainer.child(submitButton);
        formContainer.child(buttonsContainer);
      }

      // Form submit handler
      formContainer.el.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;

        // Validate
        const errors = this.validate(schema.fields, formData);
        if (Object.keys(errors).length > 0) {
          this.showErrors(errors, errorElements);
          return;
        }

        // Clear errors
        this.clearErrors(errorElements);

        // Submit
        isSubmitting = true;
        if (submitButton) submitButton.text('Loading...').css({ opacity: '0.6' });

        try {
          await onSubmit(formData);
        } catch (error) {
          console.error('Form submit error:', error);
        } finally {
          isSubmitting = false;
          if (submitButton) submitButton.text(schema.submitText || 'Submit').css({ opacity: '1' });
        }
      });

      // Return form API
      return {
        el: formContainer,
        get: () => formContainer.get(),
        getData: () => ({ ...formData }),
        setData: (data) => {
          Object.assign(formData, data);
          this.updateFieldValues(schema.fields, formData, fieldElements);
        },
        reset: () => {
          Object.keys(formData).forEach(key => delete formData[key]);
          Object.assign(formData, initialData);
          this.updateFieldValues(schema.fields, formData, fieldElements);
          this.clearErrors(errorElements);
        },
        validate: () => {
          const errors = this.validate(schema.fields, formData);
          this.showErrors(errors, errorElements);
          return errors;
        },
        setLoading: (loading) => {
          isSubmitting = loading;
          if (submitButton) {
            submitButton
              .text(loading ? 'Loading...' : (schema.submitText || 'Submit'))
              .css({ opacity: loading ? '0.6' : '1' });
          }
        }
      };
    },

    // Create single field
    createField(field, formData, fieldElements, errorElements, readOnly) {
      const wrapper = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem'
      });

      // Label
      if (field.label !== false) {
        const label = el('label')
          .css({
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          })
          .text(field.label || field.name);

        if (field.required) {
          label.child(el('span').text(' *').css({ color: '#dc2626' }));
        }

        wrapper.child(label);
      }

      // Input element
      let input;
      const value = formData[field.name] || '';

      switch (field.type) {
        case 'textarea':
          input = this.createTextarea(field, value, readOnly, formData);
          break;
        case 'select':
          input = this.createSelect(field, value, readOnly, formData);
          break;
        case 'checkbox':
          input = this.createCheckbox(field, value, readOnly, formData);
          break;
        case 'radio':
          input = this.createRadio(field, value, readOnly, formData);
          break;
        default:
          input = this.createInput(field, value, readOnly, formData);
      }

      fieldElements[field.name] = input;
      wrapper.child(input);

      // Error message
      const errorEl = el('div')
        .css({
          fontSize: '0.75rem',
          color: '#dc2626',
          minHeight: '1rem',
          display: 'none'
        });
      errorElements[field.name] = errorEl;
      wrapper.child(errorEl);

      return wrapper;
    },

    // Create input element
    createInput(field, value, readOnly, formData) {
      const input = el('input')
        .attr('type', field.type || 'text')
        .attr('name', field.name)
        .attr('placeholder', field.placeholder || '')
        .value(value);
      if (field.required) input.attr('required', true);
      if (readOnly) input.attr('readonly', true).attr('disabled', true);
      input
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          transition: 'border-color 0.2s'
        })
        .on('focus', function() {
          this.style.borderColor = '#2563eb';
        })
        .on('blur', function() {
          this.style.borderColor = '#d1d5db';
        })
        .on('input', function(e) {
          formData[field.name] = field.type === 'number' ? (this.value === '' ? '' : Number(this.value)) : this.value;
        });
      return input;
    },

    // Create textarea element
    createTextarea(field, value, readOnly, formData) {
      const textarea = el('textarea')
        .attr('name', field.name)
        .attr('placeholder', field.placeholder || '')
        .attr('rows', field.rows || 4);
      if (readOnly) textarea.attr('readonly', true).attr('disabled', true);
      textarea
        .text(value)
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s'
        })
        .on('input', function(e) {
          formData[field.name] = this.value;
        });
      return textarea;
    },

    // Create select element
    createSelect(field, value, readOnly, formData) {
      const options = field.options || [];
      
      const select = el('select')
        .attr('name', field.name);
      if (field.required) select.attr('required', true);
      if (readOnly) select.attr('readonly', true).attr('disabled', true);
      select
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          backgroundColor: '#fff',
          cursor: readOnly ? 'not-allowed' : 'pointer'
        });

      // Placeholder option
      if (field.placeholder) {
        select.child(
          el('option')
            .attr('value', '')
            .text(field.placeholder)
        );
      }

      // Options
      options.forEach(opt => {
        const option = el('option')
          .attr('value', opt.value)
          .text(opt.label);

        if (opt.value === value) {
          option.attr('selected', 'selected');
        }

        select.child(option);
      });

      select.on('change', function(e) {
        formData[field.name] = this.value;
      });

      // Sync default selected value into formData
      if (!formData[field.name] && options.length > 0) {
        if (field.placeholder) {
          // placeholder present: default is empty, leave formData as-is
        } else {
          // No placeholder: first option is auto-selected by browser
          formData[field.name] = options[0].value;
        }
      }

      return select;
    },

    // Create checkbox element
    createCheckbox(field, value, readOnly, formData) {
      const container = el('div').css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      });

      const checkbox = el('input')
        .attr('type', 'checkbox')
        .attr('name', field.name)
        .attr('checked', !!value);
      if (readOnly) checkbox.attr('readonly', true).attr('disabled', true);
      checkbox
        .css({
          width: '1rem',
          height: '1rem',
          cursor: readOnly ? 'not-allowed' : 'pointer'
        })
        .on('change', function(e) {
          formData[field.name] = this.checked;
        });

      const label = el('span')
        .css({
          fontSize: '0.95rem',
          color: '#374151'
        })
        .text(field.label || field.name);

      container.child([checkbox, label]);
      return container;
    },

    // Create radio group
    createRadio(field, value, readOnly, formData) {
      const container = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      });

      const options = field.options || [];
      options.forEach(opt => {
        const row = el('div').css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        });

        const radio = el('input')
          .attr('type', 'radio')
          .attr('name', field.name)
          .attr('value', opt.value)
          .attr('checked', opt.value === value)
          .css({
            width: '1rem',
            height: '1rem',
            cursor: readOnly ? 'not-allowed' : 'pointer'
          })
          .on('change', function(e) {
            formData[field.name] = this.value;
          });
        if (readOnly) radio.attr('disabled', true);

        const label = el('span')
          .css({
            fontSize: '0.95rem',
            color: '#374151'
          })
          .text(opt.label);

        row.child([radio, label]);
        container.child(row);
      });

      return container;
    },

    // Validate form data
    validate(fields, formData) {
      const errors = {};

      fields.forEach(field => {
        const value = formData[field.name];
        const fieldErrors = [];

        // Required validation
        if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
          fieldErrors.push(`${field.label || field.name} is required`);
        }

        // Skip other validations if empty and not required
        if (!value && !field.required) return;

        // Min length
        if (field.validation?.minLength && typeof value === 'string') {
          if (value.length < field.validation.minLength) {
            fieldErrors.push(`Minimum ${field.validation.minLength} characters`);
          }
        }

        // Max length
        if (field.validation?.maxLength && typeof value === 'string') {
          if (value.length > field.validation.maxLength) {
            fieldErrors.push(`Maximum ${field.validation.maxLength} characters`);
          }
        }

        // Pattern
        if (field.validation?.pattern && typeof value === 'string') {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            fieldErrors.push(field.validation.patternMessage || 'Invalid format');
          }
        }

        // Email
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            fieldErrors.push('Invalid email format');
          }
        }

        // Min number
        if (field.validation?.min && typeof value === 'number') {
          if (value < field.validation.min) {
            fieldErrors.push(`Minimum value is ${field.validation.min}`);
          }
        }

        // Max number
        if (field.validation?.max && typeof value === 'number') {
          if (value > field.validation.max) {
            fieldErrors.push(`Maximum value is ${field.validation.max}`);
          }
        }

        // Custom validation
        if (field.validation?.custom && typeof field.validation.custom === 'function') {
          const customError = field.validation.custom(value, formData);
          if (customError) {
            fieldErrors.push(customError);
          }
        }

        if (fieldErrors.length > 0) {
          errors[field.name] = fieldErrors;
        }
      });

      return errors;
    },

    // Show validation errors
    showErrors(errors, errorElements) {
      Object.keys(errorElements).forEach(fieldName => {
        const errorEl = errorElements[fieldName];
        if (errors[fieldName]) {
          errorEl
            .text(errors[fieldName].join(', '))
            .css({ display: 'block' });
        } else {
          errorEl.css({ display: 'none' });
        }
      });
    },

    // Clear all errors
    clearErrors(errorElements) {
      Object.values(errorElements).forEach(errorEl => {
        errorEl.css({ display: 'none' });
      });
    },

    // Update field values (for edit mode)
    updateFieldValues(fields, formData, fieldElements) {
      fields.forEach(field => {
        const element = fieldElements[field.name];
        if (!element) return;

        const value = formData[field.name];

        if (field.type === 'checkbox') {
          element.el.querySelector('input[type="checkbox"]').checked = !!value;
        } else if (field.type === 'radio') {
          element.el.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.checked = radio.value === value;
          });
        } else if (field.type === 'select') {
          element.el.value = value || '';
        } else if (field.type === 'textarea') {
          element.el.value = value || '';
        } else {
          element.el.value = value || '';
        }
      });
    }
  };

  return FormBuilder;
}));
