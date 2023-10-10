// Load environment variables from a .env file
require('dotenv').config();

// Import required Node.js modules
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const yaml = require('js-yaml');
const marked = require('marked');
const cheerio = require('cheerio');
const ejs = require('ejs');
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
const {minify} = require("html-minifier");

// Create a logger instance with the name 'dainiki-build'
const logger = new Logger('dainiki-build');

// Get the absolute path to the current script (build.js)
const scriptPath = __filename;

// Calculate the base directory by going up two levels from the script
const baseDir = path.dirname(path.dirname(scriptPath));

// Create a path to the blog configuration directory based on the base directory
const config = path.join(baseDir, blogConfigDir);

const siteConfigFile = path.join(config, siteConfig)


// Create a path to the JSON schema file for site validation
const siteSchemaPath = path.join(config, 'schema', 'site.schema.json');

// Read the JSON schema content from the schema file
const siteSchemaContent = fs.readFileSync(siteSchemaPath, 'utf8');

// Parse the JSON schema content into a JavaScript object
const siteSchema = JSON.parse(siteSchemaContent);

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
    const blogConfig = loadBlogConfig();
    const siteConfig = loadSiteConfig();

    buildBlog(blogConfig);
    buildIndex(siteConfig, blogConfig)
}

const buildIndex = (siteConfig, blogConfig) => {
    const index = path.join(baseDir, viewDir, "index.html");
    const buildIndex = path.join(buildDir, "index.html");
    const template = fs.readFileSync(index, 'utf-8');

    // Render the template with the data
    const htmlContent = ejs.render(template, {blogConfig});

    // Apply SEO optimization.
    const seoHtml = seo(htmlContent, config);

    const minified = minifyPage(seoHtml)

    // Write the final HTML to a new file (e.g., 'output.html').
    fs.writeFileSync(buildIndex, minified, 'utf-8');
}
/**
 * Build static blog pages based on provided blog configuration.
 *
 * This function generates static HTML pages for each blog post using a template.
 * It reads Markdown content, converts it to HTML, injects it into the template,
 * and applies SEO optimization.
 *
 * @param {Array<Object>} blogConfig - An array of blog post configurations.
 * @throws {Error} If an error occurs during the build process.
 */
const buildBlog = (blogConfig) => {
    try {
        // Define paths for the blog view directory, blog HTML template, and build directory.
        const blogViewDirPath = path.join(baseDir, viewDir, "blog");
        const blogView = path.join(baseDir, viewDir, "blog.html");
        const buildDirPath = path.join(baseDir, buildDir);

        // Read the HTML template file.
        const template = fs.readFileSync(blogView, 'utf-8');

        if (!fs.existsSync(buildDirPath)) {
            // If the build folder doesn't exist, create it.
            fs.mkdirSync(buildDirPath, {recursive: true});
        } else {
            // If the build folder exists, delete its contents.
            deleteFilesUnderDir(buildDirPath);
        }

        // Iterate through each blog post configuration.
        for (const config of blogConfig) {
            const blogFile = path.join(blogViewDirPath, config.filename);
            if (!fs.existsSync(blogFile)) {
                // Log an error and exit if the blog file is not found.
                logger.error(`File not found for blog ${config.filename}`);
                process.exit(0);
            }

            // Log the start of the blog page build.
            logger.info(`Build blog page for ${config.url}`);

            // Read the content of the Markdown file.
            const fileContent = fs.readFileSync(blogFile, 'utf8');

            // Convert Markdown to HTML.
            const htmlContent = marked.parse(fileContent);

            // Inject the HTML content into the template.
            const html = template.replace('<div id="markdown-content"></div>', `<div id="markdown-content">${htmlContent}</div>`);


            // Apply SEO optimization.
            const seoHtml = seo(html, config);

            const minified = minifyPage(seoHtml)
            // Define the path for the output HTML file.
            const outputFile = path.join(buildDirPath, `${config.url}.html`);

            // Write the final HTML to a new file (e.g., 'output.html').
            fs.writeFileSync(outputFile, minified);

        }
    } catch (error) {
        // Handle any errors that may occur during the blog build process.
        logger.error(`Error building blog: ${error.message}`);
        throw error;
    }
};


/**
 * Load and validate the site configuration from a YAML file.
 *
 * This function reads the content of a YAML file containing site configuration,
 * validates it against a predefined JSON schema, and returns the configuration data.
 * If the configuration is invalid, it logs errors and exits the process.
 *
 * @returns {Object} The site configuration data as a JavaScript object.
 * @throws {Error} If the loaded configuration is invalid.
 */
const loadSiteConfig = () => {
    try {
        // Read the content of the YAML file
        const fileContent = fs.readFileSync(siteConfigFile, 'utf8');

        // Parse the YAML data into a JavaScript object
        const yamlData = yaml.load(fileContent);

        // Validate the YAML data against the predefined schema
        const validate = validateConfig(yamlData, siteSchema);

        // If the YAML data is not valid, log errors and exit the process
        if (!validate.isValid) {
            logger.error(`Invalid File ${siteConfigFile}. Errors are following:`);
            const errors = validate.error;
            for (const error of errors) {
                logger.error(error.message);
            }
            process.exit(0);
        }

        // Return the validated site configuration data
        return yamlData;
    } catch (error) {
        // Handle any unexpected errors that may occur
        logger.error(`Error loading and validating site configuration: ${error.message}`);
        throw error;
    }
};


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
const loadBlogConfig = () => {
    try {
        // Get the list of blog configuration files
        const files = getBlogConfigFiles();
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
const getBlogConfigFiles = () => {
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


/**
 * Recursively delete files and subdirectories under a specified directory.
 *
 * This function deletes all files and subdirectories under the given directory path.
 *
 * @param {string} folderPath - The path to the directory to delete contents from.
 * @throws {Error} If an error occurs while deleting files or directories.
 */
const deleteFilesUnderDir = (folderPath) => {
    try {
        // Get a list of all files and subdirectories in the folder
        const folderContents = fs.readdirSync(folderPath);

        // Loop through the folder contents and delete them
        for (const item of folderContents) {
            const itemPath = path.join(folderPath, item);

            // Use fs.unlinkSync to delete files and fs.rmdirSync to delete directories
            if (fs.statSync(itemPath).isFile()) {
                fs.unlinkSync(itemPath); // Delete file
            } else {
                fs.rmdirSync(itemPath, {recursive: true}); // Delete directory and its contents
            }
        }
    } catch (error) {
        // Handle any errors that may occur during deletion
        logger.error(`Error deleting files and directories under ${folderPath}: ${error.message}`);
        throw error;
    }
};


const seo = (html, config) => {
    const $ = cheerio.load(html);
    // Modify the title
    $('title').text(config.title);

// Modify the meta description
    $('meta[name="description"]').attr('content', config.description);

// Convert the modified HTML content back to a string
    return $.html();

}

const minifyPage = (optimizedHtml) => {
    // Minify the HTML using html-minifier
    return minify(optimizedHtml, {
        collapseWhitespace: true, // Minify whitespace
        removeComments: true,      // Remove HTML comments
        removeEmptyAttributes: true, // Remove empty attributes
        minifyJS: true,           // Minify inline JavaScript
        minifyCSS: true,          // Minify inline CSS
    });
}

build();
