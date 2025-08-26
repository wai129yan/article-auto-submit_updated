#!/usr/bin/env node

const { program } = require('commander');
const DynamicArticleSubmitter = require('../src/dynamic-article-submitter');
const fs = require('fs').promises;
require('dotenv').config();

program
    .version('2.0.0')
    .description('Submit articles to a single website')
    .requiredOption('-c, --config <path>', 'Path to website configuration file')
    .requiredOption('-d, --data <path>', 'Path to articles data file')
    .option('-h, --headless [boolean]', 'Run in headless mode', true)
    .option('-s, --screenshots <dir>', 'Screenshots directory', './screenshots')
    .option('-v, --verbose', 'Verbose logging')
    .parse();

const options = program.opts();

async function runSingleWebsite() {
    try {
        console.log('🚀 Starting single website article submission...');
        console.log(`Config: ${options.config}`);
        console.log(`Data: ${options.data}`);

        // Load articles data
        const articlesData = JSON.parse(await fs.readFile(options.data, 'utf8'));
        const articles = articlesData.rows || articlesData.articles || articlesData;

        if (!Array.isArray(articles)) {
            throw new Error('Articles data must be an array');
        }

        console.log(`📄 Found ${articles.length} articles to process`);

        // Initialize submitter
        const submitter = new DynamicArticleSubmitter(options.config, {
            headless: options.headless === 'true' || options.headless === true,
            screenshotDir: options.screenshots,
            logLevel: options.verbose ? 'debug' : 'info'
        });

        await submitter.loadConfig();
        await submitter.initializeDriver();
        await submitter.authenticate();

        // Process articles
        const results = await submitter.processArticles(articles);

        // Display results
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log('\n📊 Results Summary:');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((successful / results.length) * 100)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Articles:');
            results.filter(r => !r.success).forEach(result => {
                console.log(`  - ${result.title}: ${result.error}`);
            });
        }

        await submitter.close();
        process.exit(failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    }
}

runSingleWebsite();