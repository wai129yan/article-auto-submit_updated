const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

describe('Configuration Validation', () => {
    let ajv;
    let schema;

    beforeAll(async () => {
        ajv = new Ajv({ allErrors: true });
        addFormats(ajv); // Add format support including 'uri'
        const schemaPath = path.join(__dirname, '..', 'schemas', 'website-config-schema.json');
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        schema = JSON.parse(schemaContent);
    });

    test('should validate webow-cms.json configuration', async () => {
        const configPath = path.join(__dirname, '..', 'configs', 'webow-cms.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);

        const validate = ajv.compile(schema);
        const valid = validate(config);

        if (!valid) {
            console.log('Validation errors:', validate.errors);
        }

        expect(valid).toBe(true);
    });

    test('should validate wordpress-generic.json configuration', async () => {
        const configPath = path.join(__dirname, '..', 'configs', 'wordpress-generic.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);

        const validate = ajv.compile(schema);
        const valid = validate(config);

        if (!valid) {
            console.log('Validation errors:', validate.errors);
        }

        expect(valid).toBe(true);
    });
});