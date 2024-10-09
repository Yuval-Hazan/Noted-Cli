import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as getters from '../functions/getters.js'; // Import all functions from getters
import * as validations from '../functions/validations.js'; // Import all functions from validations

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main command for starting the repository
export default function startCommand(program) {
    program
        .command('start')
        .description('Initializes the main \'Noted\' repository.\nThis repository will contain all workspaces as submodules.')
        .option('-n, --name <name>', 'Specify the repository name (default: "Noted")')
        .option('-l, --local', 'Initialize as a local repository')
        .option('-r, --remote [url]', 'Initialize with a remote repository. Use "new" for GitHub creation, or specify a remote URL.')
        .addHelpText('after', `
Examples:
    $ noted start
    $ noted start --name MyNotes --local
    $ noted start --local
    $ noted start --remote
    $ noted start --name MyNotes --remote new
    $ noted start --remote https://github.com/username/repo.git
`)
        .action(async (options) => {
            try {
                // Validation to prevent both --local and --remote
                if (options.local && options.remote) {
                    console.error(chalk.red('✖ Error: ') + 'You cannot specify both --local and --remote options at the same time.');
                    return;
                }

                // Gather all user inputs upfront
                const repoName = await getters.getRepoName(options); // Fixed: Using getters to get repo name
                const repoType = await getters.getRepoType(options); // Use repoType from getters
                const remoteOption = await getters.getRemoteOption(options, repoType); // Use remoteOption from getters

                // Proceed to repository setup
                await parentSetup(repoName, repoType, remoteOption);

                console.log(chalk.green('✔ Repository initialization complete.'));
            } catch (error) {
                console.error(chalk.red('✖ Error initializing repository: ') + error.message);
            }
        });
}

async function parentSetup(repoName, repoType, remoteOption) {
    const repoPath = path.join(process.cwd(), repoName); // Full path to the new repository

    // Check if the directory already exists
    if (fs.existsSync(repoPath)) {
        console.error(chalk.red('✖ Error: ') + `Directory "${repoName}" already exists in this location.`);
        throw new Error('Directory already exists');
    }

    // Create the directory
    fs.mkdirSync(repoPath);
    console.log(chalk.green('✔ Created directory: ') + chalk.blue(repoName));

    // Initialize Git repository
    const git = simpleGit(repoPath);
    await git.init();
    console.log(chalk.green(`✔ Initialized ${repoName} as a new Git repository.`));

    // Initialize configuration content
    let configContent = {
        parent_type: repoType.toLowerCase(),
        remote_type: null,
        remote_url: null,
        createdAt: new Date().toISOString(),
    };

    // Create a README.md file
    const templatePath = path.join(__dirname, '../template/parent-readme.md');
    const readmeContent = fs.readFileSync(templatePath, 'utf-8');
    fs.writeFileSync(path.join(repoPath, 'README.md'), readmeContent);
    console.log(chalk.green('✔ Created README.md file.'));

    // Create a .notedconfig file
    const configPath = path.join(repoPath, '.notedconfig');
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log(chalk.green('✔ Created .notedconfig file.'));

    // Add and commit the initial files
    await git.add(['README.md', '.notedconfig']);
    await git.commit('Initial commit: Add README.md and .notedconfig');
    console.log(chalk.green('✔ Initial commit: Added README.md and .notedconfig'));

    // If repository is remote, set up the remote after initial commit
    if (repoType === 'Remote') {
        if (remoteOption === 'new') {
            // Initialize GitHub repository
            await initGithubParent(git, repoName, repoPath, configContent);
        } else if (validations.isValidUrl(remoteOption)) {
            // Initialize with specified remote URL
            await initUrlParent(git, repoName, repoPath, remoteOption, configContent);
        }

        // Push initial commit to remote repository
        await git.push('origin', 'main');
        console.log(chalk.green('✔ Pushed initial commit to remote repository.'));
    }
}

async function initGithubParent(git, repoName, repoPath, configContent) {
    try {
        // Check GitHub authentication status
        execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
        // If not authenticated, prompt for login
        console.log(chalk.yellow('⚠ You are not authenticated with GitHub CLI.'));
        execSync('gh auth login', { stdio: 'inherit' });
    }

    try {
        // Create GitHub repository using gh CLI
        execSync(`gh repo create ${repoName} --private --source=. --remote=origin`, { cwd: repoPath, stdio: 'ignore' });

        // Get the remote URL
        const remoteUrl = (await git.getConfig('remote.origin.url')).value;

        // Update config content
        configContent.remote_type = 'github';
        configContent.remote_url = remoteUrl;

        // Update .notedconfig file with remote info
        const configPath = path.join(repoPath, '.notedconfig');
        fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
        await git.add('.notedconfig');
        await git.commit('Update .notedconfig with remote info');

        console.log(chalk.green(`✔ GitHub repository created: ${remoteUrl}`));
    } catch (error) {
        console.log(chalk.red(`✖ Error creating GitHub repository ${repoName}.`));
        throw error;
    }
}

async function initUrlParent(git, repoName, repoPath, remoteUrl, configContent) {
    await git.addRemote('origin', remoteUrl);
    console.log(chalk.green(`✔ Added remote URL: ${remoteUrl}`));

    configContent.remote_type = 'url';
    configContent.remote_url = remoteUrl;

    // Update .notedconfig file with remote info
    const configPath = path.join(repoPath, '.notedconfig');
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    await git.add('.notedconfig');
    await git.commit('Update .notedconfig with remote info');
}
