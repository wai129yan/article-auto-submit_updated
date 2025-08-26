#!/usr/bin/env node

const { program } = require('commander');
const MultiWebsiteRunner = require('../src/multi-website-runner');
require('dotenv').config();

program
    .version('2.0.0')
    .description('Submit articles to multiple websites')
    .option('-d, --data <path>', 'Path to multi-website data file', './data/multi-website-data.json')
    .option('-s, --screenshots <dir>', 'Screenshots directory', './screenshots')
    .option('-r, --reports <dir>', 'Reports directory', './reports')
    .option('-v, --verbose', 'Verbose logging')
    .parse();

const options = program.opts();

async function runMultiWebsite() {
    try {
        console.log('🚀 Starting multi-website article submission...');
        console.log(`Data file: ${options.data}`);

        const runner = new MultiWebsiteRunner(options.data, {
            screenshotDir: options.screenshots,
            reportDir: options.reports,
            logLevel: options.verbose ? 'debug' : 'info'
        });

        const results = await runner.processAllWebsites();

        // Display summary
        console.log('\n📊 Final Summary:');
        console.log(`🌐 Websites: ${results.summary.successfulWebsites}/${results.summary.totalWebsites} successful`);
        console.log(`📄 Articles: ${results.summary.successfulArticles}/${results.summary.totalArticles} successful`);
        console.log(`📈 Overall Success Rate: ${Math.round((results.summary.successfulArticles / results.summary.totalArticles) * 100)}%`);
        console.log(`⏱️  Total Duration: ${Math.round((results.endTime - results.startTime) / 1000)}s`);

        // Display website results
        console.log('\n🌐 Website Results:');
        results.websites.forEach(website => {
            const status = website.success ? '✅' : '❌';
            console.log(`  ${status} ${website.name}: ${website.successfulArticles}/${website.totalArticles} articles`);
            if (website.error) {
                console.log(`    Error: ${website.error}`);
            }
        });

        process.exit(results.summary.failedWebsites > 0 ? 1 : 0);

    } catch (error) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    }
}

runMultiWebsite();