import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main command for starting the repository
export default function startCommand(program) {
    program
        .command('start')
        .description('Initializes the main \'Noted\' repository.\nThis repository will contain all workspaces as submodules.')
        .option('-n, --name <name>', 'Specify the repository name (default: "Noted")')
        .option('-, --local', 'Initialize as a local repository')
        .option('-r, --remote [url]', 'Initialize with a remote repository. Use "new" for GitHub creation, or specify a remote URL.')
        .addHelpText('after', `
Examples:
    $ noted start
    $ noted start --name MyNotes --local
    $ noted start --local
    $ noted start --remote
    $ noted start --name MyNotes --remote new
    $ noted start --remote www.example.com/repo.git
`)
        .action(async (options) => {
            try {
                // Validation to prevent both --local and --remote
                if (options.local && options.remote) {
                    console.error(chalk.red('✖ Error: ') + 'You cannot specify both --local and --remote options at the same time.');
                    return;
                }

                // Define repo name either by prompt or option
                let repoName;
                if (!options.name) {
                    const { chosenRepoName } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'chosenRepoName',
                            message: 'Enter a name for the repository:',
                            default: 'Noted',
                        }
                    ]);
                    repoName = chosenRepoName;
                } else {
                    repoName = options.name;
                }

                let git, repoPath;

                if (!options.local && !options.remote) {
                    // If neither --local nor --remote is provided, prompt for the type
                    const { repoType } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'repoType',
                            message: 'Do you want to create a local or remote repository?',
                            choices: ['Local', 'Remote']
                        }
                    ]);

                    ({ git, repoPath } = await setupRepoAndGit(repoName));

                    if (repoType === 'Local') {
                        await initLocal(git, repoName, repoPath);
                    } else {
                        await handleRemoteSetup(git, repoName, repoPath);
                    }

                } else {
                    // Handle the provided options (local or remote)
                    ({ git, repoPath } = await setupRepoAndGit(repoName));

                    if (options.local) {
                        await initLocal(git, repoName, repoPath);
                    } else if (options.remote === 'new') {
                        // Handle GitHub setup if the remote is new
                        await initGithub(git, repoName, repoPath);
                    } else if (options.remote && isValidUrl(options.remote)) {
                        // Handle manual URL setup if it's a valid URL
                        await initUrl(git, repoName, repoPath, options.remote);
                    } else {
                        // If remote is specified but no valid URL or new is passed, handle via Inquirer prompt
                        await handleRemoteSetup(git, repoName, repoPath);
                    }
                }

                console.log(chalk.green('✔ Repository initialization complete.'));

            } catch (error) {
                console.error(chalk.red('✖ Error initializing repository: ') + error.message);
            }
        });
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

async function setupRepoAndGit(repoName) {
    const repoPath = path.join(process.cwd(), repoName);

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
    console.log(chalk.green('✔ Initialized a new Git repository.'));

    return { git, repoPath };
}

async function createInitialCommit(git, repoPath, configContent) {
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
    console.log(chalk.green('✔ Initial commit: Add README.md and .notedconfig'));
}

async function initLocal(git, repoName, repoPath) {
    const configContent = {
        parent_type: 'local',
        remote_type: null,
        remote_url: null,
        createdAt: new Date().toISOString(),
    };

    await createInitialCommit(git, repoPath, configContent);
}

async function initGithub(git, repoName, repoPath) {
    try {
        execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
        console.log(chalk.yellow('⚠ You are not authenticated with GitHub CLI.'));
        execSync('gh auth login', { stdio: 'inherit' });
    }

    try {

        execSync(`gh repo create ${repoName} --private`, { stdio: 'inherit' });
        const remoteUrl = `https://github.com/your-username/${repoName}.git`;
        await git.addRemote('origin', remoteUrl);
        console.log(chalk.green(`✔ Added GitHub remote: ${remoteUrl}`));

        const configContent = {
            parent_type: 'remote',
            remote_type: 'github',
            remote_url: remoteUrl,
            createdAt: new Date().toISOString(),
        };

        await createInitialCommit(git, repoPath, configContent);
    } catch (error) {
        console.log(chalk.red(`✖ Error creating GitHub repository ${repoName}. (Make sure it doesn't already exist.)`));
        console.error(error);
    }
}

async function initUrl(git, repoName, repoPath, remoteUrl) {
    await git.addRemote('origin', remoteUrl);
    console.log(chalk.green(`✔ Added remote URL: ${remoteUrl}`));

    const configContent = {
        parent_type: 'remote',
        remote_type: 'url',
        remote_url: remoteUrl,
        createdAt: new Date().toISOString(),
    };

    await createInitialCommit(git, repoPath, configContent);
}

async function handleRemoteSetup(git, repoName, repoPath) {
    const { remoteType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'remoteType',
            message: 'How would you like to configure the remote repository?',
            choices: ['GitHub (new)', 'Manual URL']
        }
    ]);

    if (remoteType === 'GitHub (new)') {
        await initGithub(git, repoName, repoPath);
    } else {
        const { manualUrl } = await inquirer.prompt({
            type: 'input',
            name: 'manualUrl',
            message: 'Enter remote URL:',
            validate: (input) => {
                if (isValidUrl(input)) {
                    return true;
                }
                return 'Please enter a valid URL';
            }
        });
        await initUrl(git, repoName, repoPath, manualUrl);
    }
}
