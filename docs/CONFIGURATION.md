# Configuration Guide

## Overview

The Dynamic Article Submitter uses JSON configuration files to define how to interact with different websites. Each website requires its own configuration file.

## Configuration Structure

### Basic Structure
```json
{
  "name": "Website Name",
  "baseUrl": "https://website.com",
  "authentication": { ... },
  "navigation": { ... },
  "formFields": { ... },
  "actions": { ... },
  "settings": { ... }
}
```

## Authentication Configuration

### Form-Based Authentication
```json
"authentication": {
  "type": "form",
  "loginUrl": "/admin/login",
  "selectors": {
    "username": "#username",
    "password": "#password",
    "submitButton": "input[type='submit']"
  },
  "credentials": {
    "username": "${WEBSITE_USERNAME}",
    "password": "${WEBSITE_PASSWORD}"
  },
  "successIndicator": ".dashboard",
  "failureIndicator": ".error-message"
}
```

### Basic Authentication
```json
"authentication": {
  "type": "basic",
  "credentials": {
    "username": "${API_USERNAME}",
    "password": "${API_PASSWORD}"
  }
}
```

### No Authentication
```json
"authentication": {
  "type": "none"
}
```

## Navigation Configuration

```json
"navigation": {
  "newArticleUrl": "/admin/articles/new",
  "fallbackSelectors": {
    "newArticleButton": "a[href*='new']",
    "articlesMenu": "#articles-menu"
  },
  "waitForElement": "#article-form",
  "customNavigation": "document.querySelector('#menu').click();"
}
```

## Form Fields Configuration

### Text Fields
```json
"title": {
  "selector": "#title",
  "type": "text",
  "required": true,
  "maxLength": 255,
  "placeholder": "Enter title here"
}
```

### Textarea Fields
```json
"content": {
  "selector": "#content",
  "type": "textarea",
  "required": true,
  "richText": true,
  "waitForEditor": true
}
```

### Select Fields
```json
"status": {
  "selector": "#status",
  "type": "select",
  "options": {
    "draft": "Draft",
    "publish": "Published",
    "pending": "Pending Review"
  },
  "default": "draft"
}
```

### Date Fields
```json
"publishDate": {
  "selector": "#publish-date",
  "type": "date",
  "format": "YYYY-MM-DD HH:mm:ss",
  "timezone": "UTC"
}
```

### Checkbox Fields
```json
"featured": {
  "selector": "#featured",
  "type": "checkbox",
  "value": true
}
```

### File Upload Fields
```json
"featuredImage": {
  "selector": "#featured-image",
  "type": "file",
  "accept": ".jpg,.png,.gif",
  "maxSize": "5MB"
}
```

## Actions Configuration

```json
"actions": {
  "save": {
    "selector": "#save-button",
    "waitForSuccess": ".success-message",
    "confirmDialog": true,
    "timeout": 10000
  },
  "publish": {
    "selector": "#publish-button",
    "waitForSuccess": ".published-indicator",
    "prerequisite": "save"
  },
  "preview": {
    "selector": "#preview-button",
    "newWindow": true
  }
}
```

## Settings Configuration

```json
"settings": {
  "pageLoadTimeout": 30000,
  "elementTimeout": 10000,
  "retryAttempts": 3,
  "delayBetweenActions": 1000,
  "headless": true,
  "takeScreenshots": true,
  "windowSize": {
    "width": 1920,
    "height": 1080
  },
  "userAgent": "Custom User Agent String"
}
```

## Advanced Features

### Custom Scripts
```json
"customScripts": {
  "beforeLogin": "console.log('Starting login process');",
  "afterLogin": "localStorage.setItem('automated', 'true');",
  "beforeSubmit": "document.querySelector('#auto-save').checked = false;",
  "afterSubmit": "window.scrollTo(0, 0);"
}
```

### Conditional Logic
```json
"formFields": {
  "category": {
    "selector": "#category",
    "type": "select",
    "condition": "article.type === 'blog'",
    "options": { ... }
  }
}
```

### Dynamic Selectors
```json
"formFields": {
  "tags": {
    "selector": "input[name='tags[]']:nth-child({{index}})",
    "type": "text",
    "multiple": true
  }
}
```

## Validation

Validate your configuration:
```bash
npm run validate -- configs/your-config.json
```

## Best Practices

1. **Use Environment Variables**: Never hardcode credentials
2. **Test Selectors**: Verify selectors work in browser dev tools
3. **Set Appropriate Timeouts**: Balance speed vs reliability
4. **Use Fallback Selectors**: Provide alternatives for navigation
5. **Enable Screenshots**: Helpful for debugging
6. **Start Simple**: Begin with basic fields, add complexity gradually

## Common Patterns

### WordPress Configuration
```json
{
  "name": "WordPress Site",
  "baseUrl": "https://yoursite.com",
  "authentication": {
    "type": "form",
    "loginUrl": "/wp-admin",
    "selectors": {
      "username": "#user_login",
      "password": "#user_pass",
      "submitButton": "#wp-submit"
    }
  },
  "navigation": {
    "newArticleUrl": "/wp-admin/post-new.php"
  },
  "formFields": {
    "title": {
      "selector": "#title",
      "type": "text"
    },
    "content": {
      "selector": "#content",
      "type": "textarea",
      "richText": true
    }
  }
}
```