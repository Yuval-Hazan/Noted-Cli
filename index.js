#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Commander.js
const program = new Command();
program
    .name('noted')
    .description('A note-taking app with Git version control. Get Started now with "noted start"!')
    .version('1.0.0');

// Dynamically load all command files from the "commands" directory
const commandsDir = path.join(__dirname, 'commands');

// Collect promises for dynamic imports
const commandPromises = fs.readdirSync(commandsDir).map((file) => {
    if (file.endsWith('.js')) {
        const commandPath = path.join(commandsDir, file);
        // console.log('Importing command from:', commandPath);

        // Dynamically import the command module
        return import(commandPath)
            .then((commandModule) => {
                const command = commandModule.default || commandModule;
                // console.log('Registering command from:', commandPath);
                command(program);  // Register the command
            })
            .catch((error) => {
                console.error(`Error loading command ${file}:`, error);
            });
    }
});

// Wait for all commands to be imported before parsing arguments
Promise.all(commandPromises).then(() => {
    // console.log('Parsing command-line arguments...');
    program.parse(process.argv);
});
