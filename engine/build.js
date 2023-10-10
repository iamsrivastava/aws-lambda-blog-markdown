// Load environment variables from a .env file
require('dotenv').config();

// Import required Node.js modules
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const yaml = require('js-yaml');

// Get the path to the blog configuration directory from environment variables
const blogConfigDir = process.env.BLOG_CONFIG_DIR;

// Get the path to the site configuration file from environment variables
const siteConfig = process.env.SITE_CONFIG;

// Get the path to the build directory from environment variables
const buildDir = process.env.BUILD_DIR;

// Get the path to the view directory from environment variables
const viewDir = process.env.VIEW_DIR;

// Import the Logger class from a module named "@sailplane/logger"
const {Logger} = require("@sailplane/logger");

// Create a logger instance with the name 'dainiki-build'
const logger = new Logger('dainiki-build');

// Get the absolute path to the current script (build.js)
const scriptPath = __filename;

// Calculate the base directory by going up two levels from the script
const baseDir = path.dirname(path.dirname(scriptPath));

// Create a path to the blog configuration directory based on the base directory
const config = path.join(baseDir, blogConfigDir);

// Create a path to the 'blog' folder within the blog configuration directory
const blogConfig = path.join(config, 'blog');

// Create a path to the JSON schema file for blog post validation
const schemaFilePath = path.join(config, 'schema', 'post.schema.json');

// Read the JSON schema content from the schema file
const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');

// Parse the JSON schema content into a JavaScript object
const schema = JSON.parse(schemaContent);

// Create an instance of Ajv (a JSON Schema validator)
const ajv = new Ajv();

const build = async () => {
    const blogConfig = await loadBlogConfig();
    console.log(blogConfig)
}

const buildIndex = async () => {

}

const buildBlog = async () => {

}

const loadSiteConfig = async () => {

}

/**
 * Load and validate the blog configuration from YAML files.
 *
 * This function reads YAML files containing blog post configurations,
 * validates them against a predefined schema, and returns an array of
 * valid blog post configurations.
 *
 * @returns {Array<Object>} An array of valid blog post configurations.
 * @throws {Error} If any of the loaded configurations are invalid.
 */
const loadBlogConfig = async () => {
    try {
        // Get the list of blog configuration files
        const files = await getBlogConfigFiles();
        const configs = [];

        // Iterate through each blog configuration file
        for (const file of files) {
            // Read the content of the YAML file
            const fileContent = fs.readFileSync(file, 'utf8');

            // Parse the YAML data into a JavaScript object
            const yamlData = yaml.load(fileContent);

            // Validate the YAML data against the predefined schema
            const validate = validateConfig(yamlData, schema);

            // If the YAML data is not valid, log errors and exit the process
            if (!validate.isValid) {
                logger.error(`Invalid File ${file}. Errors are following:`);
                const errors = validate.error;
                for (const error of errors) {
                    logger.error(error.message);
                }
                process.exit(0);
            }

            // Extract valid blog post configurations and add them to the array
            for (const post of yamlData.posts) {
                configs.push(post);
            }
        }

        // Return an array of valid blog post configurations
        return configs;
    } catch (error) {
        // Handle any unexpected errors that may occur
        logger.error(`Error loading and validating blog configurations: ${error.message}`);
        throw error;
    }
};


/**
 * Get a list of valid blog configuration file paths.
 *
 * This function reads the contents of the 'blogConfig' directory and
 * filters out and returns the file paths of YAML configuration files
 * (with extensions '.yaml' or '.yml') that exist in the directory.
 *
 * @returns {Array<string>} An array of file paths to valid blog configuration files.
 */
const getBlogConfigFiles = async () => {
    try {
        // Read the list of files in the 'blogConfig' directory
        const files = fs.readdirSync(blogConfig);

        // Filter out only valid configuration files (YAML or YML)
        const fileNames = files
            .map((file) => path.join(blogConfig, file))
            .filter((filePath) => {
                const fileExtension = path.extname(filePath).toLowerCase();
                return fileExtension === '.yaml' || fileExtension === '.yml';
            })
            .filter((filePath) => fs.statSync(filePath).isFile());

        // Return an array of valid blog configuration file paths
        return fileNames;
    } catch (error) {
        // Handle any unexpected errors that may occur
        logger.error(`Error getting blog configuration files: ${error.message}`);
        throw error;
    }
};


/**
 * Validate a configuration object against a given JSON schema.
 *
 * This function takes a configuration object and validates it against
 * a specified JSON schema using the Ajv (JSON Schema validator) instance.
 *
 * @param {Object} fileContent - The configuration data to validate.
 * @param {Object} schema - The JSON schema against which to validate the data.
 * @returns {Object} An object containing validation results.
 *   - isValid (boolean): Indicates whether the configuration is valid.
 *   - error (Array|null): An array of validation errors if the configuration is invalid; otherwise, null.
 */
const validateConfig = (fileContent, schema) => {
    try {
        // Compile the JSON schema using the Ajv instance
        const validate = ajv.compile(schema);

        // Validate the configuration data against the specified schema
        const valid = validate(fileContent);

        // Return an object containing validation results
        return {isValid: valid, error: validate.errors};
    } catch (error) {
        // Handle any unexpected errors that may occur during validation
        logger.error(`Error validating configuration: ${error.message}`);
        throw error;
    }
};


build();
