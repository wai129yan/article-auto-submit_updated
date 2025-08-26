# Dynamic Multi-Website Article Submitter

A powerful, configurable automation tool for submitting articles to multiple websites using Selenium WebDriver. This system supports various CMS platforms including custom systems and WordPress.

## Features

- **Multi-Website Support**: Submit articles to multiple websites simultaneously
- **Configurable Authentication**: Support for form-based and basic authentication
- **Flexible Field Mapping**: Map article data to different form fields across websites
- **Robust Error Handling**: Retry mechanisms and detailed error reporting
- **Screenshot Capture**: Automatic screenshots for debugging and verification
- **Comprehensive Reporting**: JSON and HTML reports with detailed submission results
- **Environment Variable Support**: Secure credential management
- **Schema Validation**: Validate configurations before execution

## Quick Start

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
# Website Credentials
WEBOW_USERNAME=your_username
WEBOW_PASSWORD=your_password
WORDPRESS_USERNAME=your_wp_username
WORDPRESS_PASSWORD=your_wp_password

# Optional Settings
HEADLESS_MODE=true
SCREENSHOT_DIR=screenshots
REPORT_DIR=reports
```

### Basic Usage

#### Single Website
```bash
npm run start:single -- --config configs/webow-cms.json --data data/articles.json
```

#### Multiple Websites
```bash
npm run start:multi -- --data data/multi-website-data.json
```

#### Validate Configuration
```bash
npm run validate -- configs/webow-cms.json
```

## Project Structure
