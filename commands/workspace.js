import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { commitChanges } from '../functions/commitHelper.js'; // Import the commit helper
import { isMainNotedRepo } from '../functions/isParent.js';   // Import the isMainNotedRepo helper

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
    $ noted workspace add --remote www.example.com/repo.git
`)
        .action(async (options) => {
            try {
                if (options.local && options.remote) {
                    console.error(chalk.red('✖ Error: ') + 'You cannot specify both --local and --remote options at the same time.');
                    return;
                }

                const parentRepoPath = process.cwd();
                if (!isMainNotedRepo(parentRepoPath)) {
                    console.error(chalk.red('✖ Error: ') + 'You must be inside the main Noted repository to add a workspace.');
                    return;
                }

                // Define workspace name either by prompt or option
                let workspaceName;
                if (!options.name) {
                    const { chosenWorkspaceName } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'chosenWorkspaceName',
                            message: 'Enter a name for the workspace:',
                            default: 'untitled-workspace',
                        }
                    ]);
                    workspaceName = chosenWorkspaceName;
                } else {
                    workspaceName = options.name;
                }

                let git, workspacePath, remoteUrl;

                ({ git, workspacePath, workspaceName } = await setupWorkspaceRepoAndGit(parentRepoPath, workspaceName));

                if (!options.local && !options.remote) {
                    const { repoType } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'repoType',
                            message: 'Do you want to create a local or remote workspace?',
                            choices: ['Local', 'Remote']
                        }
                    ]);

                    if (repoType === 'Local') {
                        await initWorkspace(git, workspaceName, workspacePath);
                    } else {
                        remoteUrl = await handleRemoteWorkspaceSetup(git, workspaceName, workspacePath);
                    }

                } else if (options.local) {
                    await initWorkspace(git, workspaceName, workspacePath);
                } else if (options.remote === 'new') {
                    remoteUrl = await initGithubWorkspace(git, workspaceName, workspacePath);
                } else if (options.remote && isValidUrl(options.remote)) {
                    remoteUrl = await initUrlWorkspace(git, workspaceName, workspacePath, options.remote);
                } else {
                    remoteUrl = await handleRemoteWorkspaceSetup(git, workspaceName, workspacePath);
                }

                // Add the workspace as a submodule to the parent repository
                const parentGit = simpleGit(parentRepoPath);
                console.log(remoteUrl);
                if (remoteUrl) {
                    // Use remote URL if available
                    await parentGit.submoduleAdd(remoteUrl, workspaceName);
                    console.log(chalk.green('✔ Added remote workspace as a submodule: ') + workspaceName);
                } else {
                    // Use local path if it's a local workspace
                    await parentGit.submoduleAdd(workspacePath, workspaceName);
                    console.log(chalk.green('✔ Added local workspace as a submodule: ') + workspaceName);
                }

                // Now, commit the addition of the submodule in the parent repository
                await commitChanges(parentRepoPath, `Add workspace: ${workspaceName}`);

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

                // Deinitialize the submodule
                await parentGit.raw(['submodule', 'deinit', '-f', workspaceName]);
                console.log(chalk.green(`✔ Deinitialized submodule: ${workspaceName}`));

                // Remove the submodule
                await parentGit.raw(['rm', '-f', workspaceName]);
                console.log(chalk.green(`✔ Removed submodule: ${workspaceName}`));

                // Remove the workspace directory
                fs.rmSync(workspacePath, { recursive: true, force: true });
                console.log(chalk.green(`✔ Deleted workspace directory: ${workspaceName}`));

                // Commit the deletion in the parent repository
                await commitChanges(parentRepoPath, `Delete workspace: ${workspaceName}`);

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


    // Add remote origin command
    workspace
        .command('add-remote <name> <url>')
        .description('Add a remote origin to a workspace (submodule) and update the .gitmodules file')
        .action(async (workspaceName, remoteUrl) => {
            try {
                const parentRepoPath = process.cwd();
                const workspacePath = path.join(parentRepoPath, workspaceName);

                if (!fs.existsSync(workspacePath)) {
                    console.error(chalk.red(`✖ Error: Workspace '${workspaceName}' does not exist.`));
                    return;
                }

                const git = simpleGit(workspacePath);
                await git.addRemote('origin', remoteUrl);
                console.log(chalk.green(`✔ Added remote origin "${remoteUrl}" to workspace: ${workspaceName}`));

                // Update the .gitmodules file
                const parentGit = simpleGit(parentRepoPath);
                await parentGit.raw(['config', '--file=.gitmodules', `submodule.${workspaceName}.url`, remoteUrl]);
                console.log(chalk.green(`✔ Updated .gitmodules with remote URL for workspace: ${workspaceName}`));

                // Commit changes in parent repository
                await commitChanges(parentRepoPath, `Add remote origin to workspace: ${workspaceName}`);

            } catch (error) {
                console.error(chalk.red(`✖ Error adding remote: ${error.message}`));
            }
        });

    // Remove remote origin command
    workspace
        .command('remove-remote <name>')
        .description('Remove the remote origin from a workspace (submodule) and update the .gitmodules file')
        .action(async (workspaceName) => {
            try {
                const parentRepoPath = process.cwd();
                const workspacePath = path.join(parentRepoPath, workspaceName);

                if (!fs.existsSync(workspacePath)) {
                    console.error(chalk.red(`✖ Error: Workspace '${workspaceName}' does not exist.`));
                    return;
                }

                const git = simpleGit(workspacePath);

                // Check if the remote exists
                const remotes = await git.getRemotes(true);
                if (!remotes.find(remote => remote.name === 'origin')) {
                    console.error(chalk.red(`✖ Error: No remote origin found for workspace: ${workspaceName}`));
                    return;
                }

                // Remove the remote origin from the submodule
                await git.removeRemote('origin');
                console.log(chalk.green(`✔ Removed remote origin from workspace: ${workspaceName}`));

                // Update the .gitmodules file
                const parentGit = simpleGit(parentRepoPath);
                await parentGit.raw(['config', '--file=.gitmodules', '--unset', `submodule.${workspaceName}.url`]);
                console.log(chalk.green(`✔ Updated .gitmodules after removing remote origin for workspace: ${workspaceName}`));

                // Commit changes in parent repository
                await commitChanges(parentRepoPath, `Remove remote origin from workspace: ${workspaceName}`);

            } catch (error) {
                console.error(chalk.red(`✖ Error removing remote: ${error.message}`));
            }
        });
}

// Helper functions

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

async function setupWorkspaceRepoAndGit(parentRepoPath, workspaceName) {
    let workspacePath = path.join(parentRepoPath, workspaceName);
    let counter = 1;
    const baseWorkspaceName = workspaceName;

    while (fs.existsSync(workspacePath)) {
        workspaceName = `${baseWorkspaceName}-${counter}`;
        workspacePath = path.join(parentRepoPath, workspaceName);
        counter++;
    }

    // Create the workspace directory
    fs.mkdirSync(workspacePath);
    console.log(chalk.green('✔ Created workspace directory: ') + chalk.blue(workspaceName));

    // Initialize Git repository
    const git = simpleGit(workspacePath);
    await git.init();
    console.log(chalk.green('✔ Initialized a new Git repository for workspace: ') + workspaceName);

    return { git, workspacePath, workspaceName };
}

async function initWorkspace(git, workspaceName, workspacePath) {
    // Create a README.md file
    const readmeContent = `# ${workspaceName}`;
    fs.writeFileSync(path.join(workspacePath, 'README.md'), readmeContent);
    console.log(chalk.green(`✔ Created README.md in workspace: ${workspaceName}`));

    // Add and commit the initial files
    await git.add(['README.md']);
    await git.commit(`Initial commit: Add README.md to ${workspaceName}`);
    console.log(chalk.green(`✔ Initial commit in workspace: ${workspaceName}`));
}

async function initGithubWorkspace(git, workspaceName, workspacePath) {
    try {
        execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
        console.log(chalk.yellow('⚠ You are not authenticated with GitHub CLI.'));
        execSync('gh auth login', { stdio: 'inherit' });
    }

    await initWorkspace(git, workspaceName, workspacePath);

    try {
        const output = execSync(`gh repo create ${workspaceName} --private --source=${workspacePath} --remote origin`, { stdio: 'pipe' }).toString();
        const remoteUrlMatch = output.match(/(?:git@|https:\/\/)github\.com[:\/][a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+(?:\.git)?/);
        const remoteUrl = remoteUrlMatch ? remoteUrlMatch[0] : null;
        console.log(remoteUrl);
        if (!remoteUrl) {
            throw new Error('Failed to retrieve the remote URL.');
        }

        console.log(chalk.green(`✔ Added GitHub remote: ${remoteUrl}`));
        return remoteUrl;
    } catch (error) {
        console.log(chalk.red(`✖ Error creating GitHub repository ${workspaceName}.`));
        throw error;
    }
}

async function initUrlWorkspace(git, workspaceName, workspacePath, remoteUrl) {
    await initWorkspace(git, workspaceName, workspacePath);
    await git.addRemote('origin', remoteUrl);
    console.log(chalk.green(`✔ Added remote URL: ${remoteUrl}`));
    return remoteUrl;
}


async function handleRemoteWorkspaceSetup(git, workspaceName, workspacePath) {
    const { remoteType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'remoteType',
            message: 'How would you like to configure the remote repository?',
            choices: ['GitHub (new)', 'Manual URL']
        }
    ]);

    if (remoteType === 'GitHub (new)') {
        return await initGithubWorkspace(git, workspaceName, workspacePath);
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
        return await initUrlWorkspace(git, workspaceName, workspacePath, manualUrl);
    }
}
