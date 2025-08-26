const fs = require('fs').promises;
const path = require('path');
const DynamicArticleSubmitter = require('./dynamic-article-submitter');
require('dotenv').config();

class MultiWebsiteRunner {
    constructor(dataPath, options = {}) {
        this.dataPath = dataPath;
        this.data = null;
        this.options = {
            logLevel: 'info',
            screenshotDir: './screenshots',
            reportDir: './reports',
            ...options
        };
        this.results = {
            websites: [],
            summary: {
                totalWebsites: 0,
                successfulWebsites: 0,
                failedWebsites: 0,
                totalArticles: 0,
                successfulArticles: 0,
                failedArticles: 0
            },
            startTime: null,
            endTime: null
        };
    }

    async loadData() {
        try {
            const dataContent = await fs.readFile(this.dataPath, 'utf8');
            this.data = JSON.parse(dataContent);
            this.log('info', `Multi-website data loaded from ${this.dataPath}`);
            return this.data;
        } catch (error) {
            throw new Error(`Failed to load data from ${this.dataPath}: ${error.message}`);
        }
    }

    async processAllWebsites() {
        this.results.startTime = new Date();
        this.log('info', 'Starting multi-website article submission process');

        if (!this.data) {
            await this.loadData();
        }

        const enabledWebsites = this.data.websites.filter(website => website.enabled);
        this.results.summary.totalWebsites = enabledWebsites.length;

        for (let i = 0; i < enabledWebsites.length; i++) {
            const website = enabledWebsites[i];
            this.log('info', `Processing website ${i + 1}/${enabledWebsites.length}: ${website.name}`);

            const websiteResult = await this.processWebsite(website);
            this.results.websites.push(websiteResult);

            // Update summary
            if (websiteResult.success) {
                this.results.summary.successfulWebsites++;
            } else {
                this.results.summary.failedWebsites++;
            }

            this.results.summary.totalArticles += websiteResult.totalArticles;
            this.results.summary.successfulArticles += websiteResult.successfulArticles;
            this.results.summary.failedArticles += websiteResult.failedArticles;

            // Add delay between websites if configured
            if (i < enabledWebsites.length - 1 && this.data.globalSettings?.delayBetweenSites) {
                this.log('info', `Waiting ${this.data.globalSettings.delayBetweenSites}ms before next website`);
                await this.sleep(this.data.globalSettings.delayBetweenSites);
            }

            // Stop processing if continueOnError is false and we have failures
            if (!this.data.globalSettings?.continueOnError && !websiteResult.success) {
                this.log('error', 'Stopping execution due to website failure and continueOnError=false');
                break;
            }
        }

        this.results.endTime = new Date();
        this.log('info', 'Multi-website processing completed');

        // Generate report if enabled
        if (this.data.globalSettings?.generateReport) {
            await this.generateReport();
        }

        return this.results;
    }

    async processWebsite(website) {
        const websiteResult = {
            name: website.name,
            configPath: website.configPath,
            success: false,
            totalArticles: website.articles.length,
            successfulArticles: 0,
            failedArticles: 0,
            articles: [],
            error: null,
            startTime: new Date(),
            endTime: null
        };

        let submitter = null;

        try {
            // Initialize submitter
            submitter = new DynamicArticleSubmitter(website.configPath, {
                ...this.options,
                screenshotDir: path.join(this.options.screenshotDir, this.sanitizeFilename(website.name))
            });

            await submitter.loadConfig();
            await submitter.initializeDriver();
            await submitter.authenticate();

            // Process articles with retry logic
            for (const article of website.articles) {
                const articleResult = await this.processArticleWithRetry(submitter, article, website);
                websiteResult.articles.push(articleResult);

                if (articleResult.success) {
                    websiteResult.successfulArticles++;
                } else {
                    websiteResult.failedArticles++;
                }
            }

            websiteResult.success = websiteResult.failedArticles === 0;
            this.log('info', `Website ${website.name} completed: ${websiteResult.successfulArticles}/${websiteResult.totalArticles} articles successful`);

        } catch (error) {
            websiteResult.error = error.message;
            websiteResult.failedArticles = websiteResult.totalArticles;
            this.log('error', `Website ${website.name} failed: ${error.message}`);
        } finally {
            if (submitter) {
                await submitter.close();
            }
            websiteResult.endTime = new Date();
        }

        return websiteResult;
    }

    async processArticleWithRetry(submitter, article, website) {
        const maxRetries = this.data.globalSettings?.maxRetries || 1;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.log('info', `Submitting article "${article.title}" (attempt ${attempt}/${maxRetries})`);
                const result = await submitter.submitArticle(article);

                if (result.success) {
                    return {
                        ...result,
                        attempt,
                        website: website.name
                    };
                } else {
                    lastError = result.error;
                    if (attempt < maxRetries) {
                        this.log('warn', `Article submission failed, retrying... (${result.error})`);
                        await this.sleep(2000); // Wait before retry
                    }
                }
            } catch (error) {
                lastError = error.message;
                if (attempt < maxRetries) {
                    this.log('warn', `Article submission error, retrying... (${error.message})`);
                    await this.sleep(2000);
                }
            }
        }

        return {
            success: false,
            error: lastError,
            title: article.title,
            attempt: maxRetries,
            website: website.name
        };
    }

    async generateReport() {
        try {
            const reportDir = this.data.globalSettings?.reportPath || this.options.reportDir;
            await fs.mkdir(reportDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(reportDir, `submission-report-${timestamp}.json`);

            const report = {
                ...this.results,
                generatedAt: new Date().toISOString(),
                duration: this.results.endTime - this.results.startTime,
                configuration: {
                    dataPath: this.dataPath,
                    options: this.options,
                    globalSettings: this.data.globalSettings
                }
            };

            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            this.log('info', `Report generated: ${reportPath}`);

            // Generate HTML report
            await this.generateHtmlReport(report, reportDir, timestamp);

        } catch (error) {
            this.log('error', `Failed to generate report: ${error.message}`);
        }
    }

    async generateHtmlReport(report, reportDir, timestamp) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Article Submission Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .number { font-size: 24px; font-weight: bold; color: #007bff; }
        .website { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .website-header { background: #007bff; color: white; padding: 15px; }
        .website-content { padding: 15px; }
        .article { margin-bottom: 10px; padding: 10px; border-left: 4px solid #ddd; background: #f8f9fa; }
        .article.success { border-left-color: #28a745; }
        .article.failed { border-left-color: #dc3545; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.success { background: #d4edda; color: #155724; }
        .status.failed { background: #f8d7da; color: #721c24; }
        .error { color: #dc3545; font-size: 12px; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Article Submission Report</h1>
            <p>Generated on ${new Date(report.generatedAt).toLocaleString()}</p>
            <p>Duration: ${Math.round(report.duration / 1000)}s</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Websites</h3>
                <div class="number">${report.summary.successfulWebsites}/${report.summary.totalWebsites}</div>
                <div>Successful</div>
            </div>
            <div class="summary-card">
                <h3>Articles</h3>
                <div class="number">${report.summary.successfulArticles}/${report.summary.totalArticles}</div>
                <div>Successful</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="number">${Math.round((report.summary.successfulArticles / report.summary.totalArticles) * 100)}%</div>
                <div>Overall</div>
            </div>
        </div>
        
        ${report.websites.map(website => `
            <div class="website">
                <div class="website-header">
                    <h2>${website.name}</h2>
                    <span class="status ${website.success ? 'success' : 'failed'}">
                        ${website.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                    <span style="float: right;">${website.successfulArticles}/${website.totalArticles} articles</span>
                </div>
                <div class="website-content">
                    ${website.error ? `<div class="error">Website Error: ${website.error}</div>` : ''}
                    ${website.articles.map(article => `
                        <div class="article ${article.success ? 'success' : 'failed'}">
                            <strong>${article.title}</strong>
                            <span class="status ${article.success ? 'success' : 'failed'}" style="float: right;">
                                ${article.success ? 'SUCCESS' : 'FAILED'}
                            </span>
                            ${article.error ? `<div class="error">Error: ${article.error}</div>` : ''}
                            ${article.attempt > 1 ? `<div style="font-size: 12px; color: #666;">Attempts: ${article.attempt}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        const htmlPath = path.join(reportDir, `submission-report-${timestamp}.html`);
        await fs.writeFile(htmlPath, htmlContent);
        this.log('info', `HTML report generated: ${htmlPath}`);
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
    }
}

module.exports = MultiWebsiteRunner;