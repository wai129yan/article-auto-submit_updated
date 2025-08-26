const { Builder, By, until, Key } = require('selenium-webdriver');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
require('dotenv').config();

class DynamicArticleSubmitter {
    constructor(configPath, options = {}) {
        this.configPath = configPath;
        this.config = null;
        this.driver = null;
        this.options = {
            headless: true,
            screenshotDir: './screenshots',
            logLevel: 'info',
            ...options
        };
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.log('info', `Configuration loaded: ${this.config.name}`);
            return this.config;
        } catch (error) {
            throw new Error(`Failed to load config from ${this.configPath}: ${error.message}`);
        }
    }

    async initializeDriver() {
        const chrome = require('selenium-webdriver/chrome');
        const options = new chrome.Options();

        if (this.options.headless || this.config.settings?.headless) {
            options.addArguments('--headless');
        }

        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');

        this.driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        await this.driver.manage().setTimeouts({
            implicit: this.config.settings?.waitTimeout || 10000,
            pageLoad: 30000,
            script: 30000
        });

        this.log('info', 'WebDriver initialized');
        return this.driver;
    }

    async authenticate() {
        const auth = this.config.authentication;

        if (auth.type === 'none') {
            this.log('info', 'No authentication required');
            return;
        }

        if (auth.type === 'basic') {
            const username = process.env[auth.credentials.usernameEnv];
            const password = process.env[auth.credentials.passwordEnv];

            if (!username || !password) {
                throw new Error(`Missing credentials: ${auth.credentials.usernameEnv} or ${auth.credentials.passwordEnv}`);
            }

            await this.driver.get(`https://${username}:${password}@${this.config.baseUrl.replace('https://', '')}`);
            this.log('info', 'Basic authentication completed');

        } else if (auth.type === 'form') {
            await this.driver.get(auth.loginUrl);
            await this.sleep(2000);

            const username = process.env[auth.credentials.usernameEnv];
            const password = process.env[auth.credentials.passwordEnv];

            if (!username || !password) {
                throw new Error(`Missing credentials: ${auth.credentials.usernameEnv} or ${auth.credentials.passwordEnv}`);
            }

            // Fill username
            const usernameField = await this.findElement(auth.selectors.username);
            await usernameField.clear();
            await usernameField.sendKeys(username);

            // Fill password
            const passwordField = await this.findElement(auth.selectors.password);
            await passwordField.clear();
            await passwordField.sendKeys(password);

            // Submit form
            const submitButton = await this.findElement(auth.selectors.submitButton);
            await submitButton.click();

            await this.sleep(3000);
            this.log('info', 'Form authentication completed');
        }

        // Execute custom script after login if provided
        if (this.config.customScripts?.afterLogin) {
            await this.executeCustomScript(this.config.customScripts.afterLogin);
        }
    }

    async navigateToNewArticleForm() {
        try {
            // Try direct URL first
            await this.driver.get(this.config.navigation.newArticleUrl);
            await this.sleep(2000);

            // Check if we're on the right page
            if (this.config.navigation.waitForElement) {
                try {
                    await this.driver.wait(
                        until.elementLocated(By.css(this.config.navigation.waitForElement)),
                        5000
                    );
                    this.log('info', 'Successfully navigated to new article form via direct URL');
                    return;
                } catch (error) {
                    this.log('warn', 'Direct URL navigation failed, trying fallback selectors');
                }
            }
        } catch (error) {
            this.log('warn', `Direct navigation failed: ${error.message}`);
        }

        // Try fallback selectors
        if (this.config.navigation.fallbackSelectors) {
            for (const fallback of this.config.navigation.fallbackSelectors) {
                try {
                    const element = await this.findElementByType(fallback.type, fallback.selector);
                    await this.driver.executeScript('arguments[0].click();', element);
                    await this.sleep(2000);

                    if (this.config.navigation.waitForElement) {
                        await this.driver.wait(
                            until.elementLocated(By.css(this.config.navigation.waitForElement)),
                            5000
                        );
                    }

                    this.log('info', `Successfully navigated using fallback: ${fallback.description || fallback.selector}`);
                    return;
                } catch (error) {
                    this.log('warn', `Fallback selector failed: ${fallback.selector}`);
                    continue;
                }
            }
        }

        throw new Error('Failed to navigate to new article form using all available methods');
    }

    async fillArticleData(articleData) {
        this.log('info', `Filling article: ${articleData.title}`);

        // Execute custom script before submit if provided
        if (this.config.customScripts?.beforeSubmit) {
            await this.executeCustomScript(this.config.customScripts.beforeSubmit);
        }

        // Fill each field based on configuration
        for (const [fieldName, fieldConfig] of Object.entries(this.config.formFields)) {
            if (articleData[fieldName] !== undefined && articleData[fieldName] !== null) {
                await this.fillField(fieldName, fieldConfig, articleData[fieldName]);
            }
        }

        this.log('info', 'Article data filled successfully');
    }

    async fillField(fieldName, fieldConfig, value) {
        try {
            const element = await this.findElementWithFallbacks(fieldConfig);

            if (!element) {
                if (fieldConfig.required) {
                    throw new Error(`Required field '${fieldName}' not found`);
                }
                this.log('warn', `Optional field '${fieldName}' not found, skipping`);
                return;
            }

            // Handle different field types
            switch (fieldConfig.fieldType) {
                case 'text':
                case 'textarea':
                    if (fieldConfig.clearBefore) {
                        await element.clear();
                    }
                    await element.sendKeys(value);
                    break;

                case 'select':
                    const mappedValue = fieldConfig.valueMapping?.[value] || value;
                    await this.selectOption(element, mappedValue);
                    break;

                case 'date':
                    const formattedDate = fieldConfig.dateFormat
                        ? moment(value).format(fieldConfig.dateFormat)
                        : value;
                    if (fieldConfig.clearBefore) {
                        await element.clear();
                    }
                    await element.sendKeys(formattedDate);
                    break;

                case 'checkbox':
                    const isChecked = await element.isSelected();
                    if ((value && !isChecked) || (!value && isChecked)) {
                        await element.click();
                    }
                    break;

                case 'radio':
                    if (value) {
                        await element.click();
                    }
                    break;

                case 'file':
                    await element.sendKeys(value);
                    break;

                default:
                    await element.sendKeys(value);
            }

            this.log('info', `Field '${fieldName}' filled with value: ${value}`);
            await this.sleep(this.config.settings?.delayBetweenActions || 500);

        } catch (error) {
            const message = `Failed to fill field '${fieldName}': ${error.message}`;
            if (fieldConfig.required) {
                throw new Error(message);
            }
            this.log('warn', message);
        }
    }

    async performAction(actionName, articleData) {
        const actionConfig = this.config.actions[actionName];

        if (!actionConfig) {
            throw new Error(`Action '${actionName}' not configured`);
        }

        try {
            const element = await this.findElementWithFallbacks(actionConfig);

            if (!element) {
                throw new Error(`Action button for '${actionName}' not found`);
            }

            // Handle confirmation dialog if expected
            if (actionConfig.confirmDialog) {
                await element.click();
                await this.sleep(1000);

                try {
                    const alert = await this.driver.switchTo().alert();
                    await alert.accept();
                    this.log('info', `Confirmed dialog for action '${actionName}'`);
                } catch (error) {
                    this.log('warn', 'Expected confirmation dialog not found');
                }
            } else {
                await element.click();
            }

            await this.sleep(actionConfig.waitAfter || 2000);

            // Check for success indicator
            if (actionConfig.successIndicator) {
                try {
                    await this.driver.wait(
                        until.elementLocated(By.css(actionConfig.successIndicator)),
                        5000
                    );
                    this.log('info', `Action '${actionName}' completed successfully`);
                } catch (error) {
                    this.log('warn', `Success indicator not found for action '${actionName}'`);
                }
            }

            // Execute custom script after submit if provided
            if (this.config.customScripts?.afterSubmit) {
                await this.executeCustomScript(this.config.customScripts.afterSubmit);
            }

            return true;

        } catch (error) {
            this.log('error', `Action '${actionName}' failed: ${error.message}`);

            if (this.config.settings?.screenshotOnError) {
                await this.takeScreenshot(`error_${actionName}_${Date.now()}`);
            }

            throw error;
        }
    }

    async findElement(selector, selectorType = 'css') {
        const locator = this.getLocator(selectorType, selector);
        return await this.driver.findElement(locator);
    }

    async findElementByType(type, selector) {
        const locator = this.getLocator(type, selector);
        return await this.driver.findElement(locator);
    }

    async findElementWithFallbacks(fieldConfig) {
        // Try primary selector
        try {
            return await this.findElement(fieldConfig.selector, fieldConfig.selectorType);
        } catch (error) {
            // Try fallback selectors
            if (fieldConfig.fallbackSelectors) {
                for (const fallbackSelector of fieldConfig.fallbackSelectors) {
                    try {
                        return await this.findElement(fallbackSelector, fieldConfig.selectorType);
                    } catch (fallbackError) {
                        continue;
                    }
                }
            }
        }
        return null;
    }

    getLocator(selectorType, selector) {
        switch (selectorType) {
            case 'css':
                return By.css(selector);
            case 'xpath':
                return By.xpath(selector);
            case 'id':
                return By.id(selector);
            case 'name':
                return By.name(selector);
            case 'className':
                return By.className(selector);
            case 'linkText':
                return By.linkText(selector);
            default:
                return By.css(selector);
        }
    }

    async selectOption(selectElement, value) {
        const options = await selectElement.findElements(By.tagName('option'));

        for (const option of options) {
            const optionValue = await option.getAttribute('value');
            const optionText = await option.getText();

            if (optionValue === value || optionText === value) {
                await option.click();
                return;
            }
        }

        throw new Error(`Option '${value}' not found in select element`);
    }

    async executeCustomScript(script) {
        try {
            await this.driver.executeScript(script);
            this.log('info', 'Custom script executed successfully');
        } catch (error) {
            this.log('warn', `Custom script execution failed: ${error.message}`);
        }
    }

    async takeScreenshot(filename) {
        try {
            const screenshot = await this.driver.takeScreenshot();
            const screenshotPath = path.join(this.options.screenshotDir, `${filename}.png`);

            // Ensure screenshot directory exists
            await fs.mkdir(this.options.screenshotDir, { recursive: true });
            await fs.writeFile(screenshotPath, screenshot, 'base64');

            this.log('info', `Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        } catch (error) {
            this.log('error', `Failed to take screenshot: ${error.message}`);
        }
    }

    async submitArticle(articleData) {
        try {
            await this.navigateToNewArticleForm();
            await this.fillArticleData(articleData);

            // Determine action based on article status
            const status = articleData.status || 'save';
            const actionName = this.config.actions[status] ? status : 'save';

            await this.performAction(actionName, articleData);

            this.log('info', `Article '${articleData.title}' submitted successfully with status: ${status}`);
            return { success: true, status, title: articleData.title };

        } catch (error) {
            this.log('error', `Failed to submit article '${articleData.title}': ${error.message}`);

            if (this.config.settings?.screenshotOnError) {
                await this.takeScreenshot(`error_submit_${Date.now()}`);
            }

            return { success: false, error: error.message, title: articleData.title };
        }
    }

    async processArticles(articles) {
        const results = [];

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            this.log('info', `Processing article ${i + 1}/${articles.length}: ${article.title}`);

            const result = await this.submitArticle(article);
            results.push(result);

            // Add delay between articles
            if (i < articles.length - 1) {
                await this.sleep(this.config.settings?.delayBetweenActions || 2000);
            }
        }

        return results;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        if (this.options.logLevel === 'info' || level === 'error') {
            console.log(logMessage);
        }

        // You can extend this to write to log files
    }

    async close() {
        if (this.driver) {
            await this.driver.quit();
            this.log('info', 'WebDriver closed');
        }
    }
}

module.exports = DynamicArticleSubmitter;