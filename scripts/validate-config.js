#!/usr/bin/env node

const { program } = require('commander');
const Ajv = require('ajv');
const fs = require('fs').promises;
const path = require('path');

program
    .version('2.0.0')
    .description('Validate website configuration files')
    .argument('<config-path>', 'Path to configuration file to validate')
    .option('-s, --schema <path>', 'Path to schema file', './website-config-schema.json')
    .parse();

const configPath = program.args[0];
const options = program.opts();

async function validateConfig() {
    try {
        console.log(`🔍 Validating configuration: ${configPath}`);

        // Load schema
        const schemaContent = await fs.readFile(options.schema, 'utf8');
        const schema = JSON.parse(schemaContent);

        // Load configuration
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);

        // Validate
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile(schema);
        const valid = validate(config);

        if (valid) {
            console.log('✅ Configuration is valid!');

            // Additional checks
            console.log('\n🔧 Additional Checks:');

            // Check required environment variables
            if (config.authentication?.credentials) {
                const { usernameEnv, passwordEnv } = config.authentication.credentials;
                if (usernameEnv && !process.env[usernameEnv]) {
                    console.log(`⚠️  Warning: Environment variable ${usernameEnv} is not set`);
                }
                if (passwordEnv && !process.env[passwordEnv]) {
                    console.log(`⚠️  Warning: Environment variable ${passwordEnv} is not set`);
                }
            }

            // Check URL accessibility (basic format check)
            try {
                new URL(config.baseUrl);
                console.log('✅ Base URL format is valid');
            } catch (error) {
                console.log('❌ Base URL format is invalid');
            }

            console.log('\n📋 Configuration Summary:');
            console.log(`  Name: ${config.name}`);
            console.log(`  Base URL: ${config.baseUrl}`);
            console.log(`  Authentication: ${config.authentication.type}`);
            console.log(`  Form Fields: ${Object.keys(config.formFields).length}`);
            console.log(`  Actions: ${Object.keys(config.actions).length}`);

        } else {
            console.log('❌ Configuration validation failed:');
            validate.errors.forEach(error => {
                console.log(`  - ${error.instancePath || 'root'}: ${error.message}`);
            });
            process.exit(1);
        }

    } catch (error) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    }
}

validateConfig();