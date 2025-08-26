# Installation Guide

## Prerequisites

- Node.js 14.x or higher
- npm or yarn package manager
- Chrome or Chromium browser (for Selenium)

## Step-by-Step Installation

### 1. Clone or Download

Download the project files to your local machine.

### 2. Install Dependencies

```bash
cd article-auto-submit_updated
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
# Required: Website credentials
WEBOW_USERNAME=your_username
WEBOW_PASSWORD=your_password

# Optional: Additional websites
WORDPRESS_USERNAME=wp_username
WORDPRESS_PASSWORD=wp_password

# Optional: Browser settings
HEADLESS_MODE=true
BROWSER_TIMEOUT=30000

# Optional: Directory settings
SCREENSHOT_DIR=screenshots
REPORT_DIR=reports
LOG_DIR=logs
```

### 4. Verify Installation

```bash
# Validate a configuration
npm run validate -- configs/webow-cms.json

# Run a test submission (dry run)
npm run test:config -- configs/webow-cms.json
```

### 5. First Run

```bash
# Start with a single article
npm run start:single -- --config configs/webow-cms.json --data data/articles.json --verbose
```

## Troubleshooting Installation

### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Update if needed (using nvm)
nvm install 18
nvm use 18
```

### Chrome/Chromium Issues
```bash
# Install Chrome on Ubuntu/Debian
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo apt-get update
sudo apt-get install google-chrome-stable

# Install on macOS
brew install --cask google-chrome
```

### Permission Issues
```bash
# Fix npm permissions (Unix/macOS)
sudo chown -R $(whoami) ~/.npm

# Alternative: use npx instead of global installs
npx selenium-webdriver
```