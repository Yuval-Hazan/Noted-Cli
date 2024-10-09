import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as getters from '../functions/getters.js';
import * as validations from '../functions/validations.js';
import * as remotes from '../functions/remoteHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function workspaceCommand(program) {
    const workspace = program.command('workspace').description('Manage workspaces inside the parent repository');

    // Add workspace command
    workspace
        .command('add')
        .description('Add a new workspace to the parent repository (can be local or remote)')
        .option('-n, --name <name>', 'Specify the workspace name (default: "untitled-workspace")')
        .option('-l, --local', 'Initialize as a local workspace')
        .option('-r, --remote [url]', 'Initialize with a remote repository. Use "new" for GitHub creation, or specify a remote URL.')
        .addHelpText('after', `
Examples:
    $ noted workspace add
    $ noted workspace add --name MyWorkspace --local
    $ noted workspace add --local
    $ noted workspace add --remote
    $ noted workspace add --name MyWorkspace --remote new
    $ noted workspace add --remote https://github.com/username/repo.git
`)
        .action(async (options) => {
            try {
                // Validate options
                if (options.local && options.remote) {
                    console.error(chalk.red('✖ Error: ') + 'You cannot specify both --local and --remote options at the same time.');
                    return;
                }

                const parentRepoPath = process.cwd();
                if (!validations.isMainNotedRepo(parentRepoPath)) {
                    console.error(chalk.red('✖ Error: ') + 'You must be inside the main Noted repository to add a workspace.');
                    return;
                }

                // Gather all user inputs upfront
                const workspaceName = await getters.getWorkspaceName(options, parentRepoPath);
                const repoType = await getters.getRepoType(options);
                const remoteOption = await getters.getRemoteOption(options, repoType);

                // Set up and initialize workspace (local or remote)
                const { git, workspacePath, remoteUrl } = await setupAndInitializeWorkspace(workspaceName, parentRepoPath, repoType, remoteOption);

                // Add the workspace as a submodule to the parent repository
                await addWorkspaceSubmodule(parentRepoPath, workspaceName, workspacePath, remoteUrl);

                console.log(chalk.green('✔ Workspace initialization complete.'));
            } catch (error) {
                console.error(chalk.red('✖ Error initializing workspace: ') + error.message);
            }
        });

    // Delete workspace command
    workspace
        .command('delete <name>')
        .description('Delete a workspace inside the parent repository')
        .action(async (workspaceName) => {
            try {
                const parentRepoPath = process.cwd();
                const workspacePath = path.join(parentRepoPath, workspaceName);

                if (!fs.existsSync(workspacePath)) {
                    console.error(chalk.red(`✖ Error: Workspace '${workspaceName}' does not exist.`));
                    return;
                }

                const parentGit = simpleGit(parentRepoPath);

                // Deinitialize the submodule using raw git commands
                await parentGit.raw(['submodule', 'deinit', '--force', workspaceName]);
                console.log(chalk.green(`✔ Deinitialized submodule: ${workspaceName}`));

                // Remove the submodule
                await parentGit.raw(['rm', '-f', workspaceName]);
                console.log(chalk.green(`✔ Removed submodule: ${workspaceName}`));

                // Remove the workspace directory
                fs.rmSync(workspacePath, { recursive: true, force: true });
                console.log(chalk.green(`✔ Deleted workspace directory: ${workspaceName}`));

                // Commit the deletion in the parent repository
                await remotes.commitChanges(parentRepoPath, `Delete workspace: ${workspaceName}`);

                console.log(chalk.green('✔ Workspace deletion complete.'));
            } catch (error) {
                console.error(chalk.red('✖ Error deleting workspace: ') + error.message);
            }
        });

    // List workspaces command
    workspace
        .command('list')
        .description('List all workspaces (submodules) in the parent repository')
        .option('-a', 'Display all submodule information (hash, branch)')
        .action(async (options) => {
            try {
                const parentRepoPath = process.cwd();
                const parentGit = simpleGit(parentRepoPath);

                // Get the list of submodules using git submodule status
                const submodules = await parentGit.raw(['submodule', 'status']);

                if (submodules.trim().length === 0) {
                    console.log(chalk.yellow('No workspaces (submodules) found.'));
                    return;
                }

                console.log(chalk.blue('Workspaces (Submodules):'));

                // Process and display either full output or just the names
                submodules.split('\n').forEach((line) => {
                    if (line.trim()) {
                        const parts = line.trim().split(' ');
                        const workspaceName = parts[1]; // The second part is the name

                        if (options.a) {
                            // Display full output (hash, branch, etc.)
                            console.log(chalk.green(line.trim()));
                        } else {
                            // Display only the workspace name
                            console.log(chalk.green(workspaceName));
                        }
                    }
                });
            } catch (error) {
                console.error(chalk.red('✖ Error listing workspaces: ') + error.message);
            }
        });

    async function setupAndInitializeWorkspace(workspaceName, parentRepoPath, repoType, remoteOption) {
        const workspacePath = path.join(parentRepoPath, workspaceName);

        // Create workspace directory
        fs.mkdirSync(workspacePath);
        console.log(chalk.green('✔ Created workspace directory: ') + chalk.blue(workspaceName));

        // Initialize Git repository
        const git = simpleGit(workspacePath);
        await git.init();
        console.log(chalk.green('✔ Initialized Git repository for workspace: ') + workspaceName);

        // Create README.md and commit initial files
        const readmeContent = `# ${workspaceName}`;
        fs.writeFileSync(path.join(workspacePath, 'README.md'), readmeContent);
        console.log(chalk.green(`✔ Created README.md in workspace: ${workspaceName}`));

        await git.add(['README.md']);
        await git.commit(`Initial commit: Add README.md to ${workspaceName}`);
        console.log(chalk.green(`✔ Initial commit in workspace: ${workspaceName}`));

        // Handle remote setup if applicable
        let remoteUrl = null;
        if (repoType === 'Remote') {
            if (remoteOption === 'new') {
                remoteUrl = await initGithubWorkspace(git, workspaceName, workspacePath);
            } else if (validations.isValidUrl(remoteOption)) {
                remoteUrl = await initUrlWorkspace(git, workspaceName, workspacePath, remoteOption);
            }
        }

        return { git, workspacePath, remoteUrl };
    }

    async function initGithubWorkspace(git, workspaceName, workspacePath) {
        try {
            // Check GitHub authentication
            execSync('gh auth status', { stdio: 'ignore' });
        } catch (error) {
            console.log(chalk.yellow('⚠ You are not authenticated with GitHub CLI.'));
            execSync('gh auth login', { stdio: 'inherit' });
        }

        try {
            // Create GitHub repository using gh CLI
            execSync(`gh repo create ${workspaceName} --private --source=. --remote origin --push`, { cwd: workspacePath, stdio: 'ignore' });

            // Get the remote URL
            const remoteUrl = (await git.getConfig('remote.origin.url')).value;
            console.log(chalk.green(`✔ GitHub repository created: ${remoteUrl}`));

            return remoteUrl;
        } catch (error) {
            console.log(chalk.red(`✖ Error creating GitHub repository ${workspaceName}.`));
            throw error;
        }
    }

    async function initUrlWorkspace(git, workspaceName, workspacePath, remoteUrl) {
        await git.addRemote('origin', remoteUrl);
        console.log(chalk.green(`✔ Added remote URL: ${remoteUrl}`));
        return remoteUrl;
    }

    async function addWorkspaceSubmodule(parentRepoPath, workspaceName, workspacePath, remoteUrl) {
        const parentGit = simpleGit(parentRepoPath);

        if (remoteUrl) {
            // Use remote URL if available
            await parentGit.raw(['submodule', 'add', remoteUrl, workspaceName]);
            console.log(chalk.green(`✔ Added remote workspace as submodule: ${workspaceName}`));
        } else {
            // Use local path if it's a local workspace
            await parentGit.raw(['submodule', 'add', workspacePath, workspaceName]);
            console.log(chalk.green(`✔ Added local workspace as submodule: ${workspaceName}`));
        }

        // Commit the addition of the submodule in the parent repository
        await remotes.commitChanges(parentRepoPath, `Add workspace: ${workspaceName}`);
    }
}
