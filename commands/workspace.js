import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { commitChanges } from '../functions/commitHelper.js'; // Import the commit helper
import { isMainNotedRepo } from '../functions/isParent.js'; // Import the isMainNotedRepo helper

export default function workspaceCommand(program) {
    const workspace = program.command('workspace').description('Manage workspaces inside the parent repository');

    // Add workspace command
    workspace
        .command('add [name]')
        .description('Add a new workspace to the parent repository (can be local or remote)')
        .option('-u, --url <url>', 'Optional remote Git repository URL for the workspace')
        .option('-l, --local', 'Keep the workspace local (default if no remote URL is provided)')
        .action(async (workspaceName, options) => {
            try {
                const parentRepoPath = process.cwd();
                if (!isMainNotedRepo(parentRepoPath)) {
                    console.error(chalk.red('✖ Error: Workspaces can only be created within the main Noted repository.'));
                    return;
                }
                if (!fs.existsSync(path.join(parentRepoPath, '.git'))) {
                    console.error(chalk.red('✖ Error: Parent repository not initialized or not a valid Git repository.'));
                    return;
                }

                let baseWorkspaceName = workspaceName || 'untitled-workspace';
                let finalWorkspaceName = baseWorkspaceName;
                let workspacePath = path.join(parentRepoPath, finalWorkspaceName);

                let counter = 1;
                while (fs.existsSync(workspacePath)) {
                    finalWorkspaceName = `${baseWorkspaceName}-${counter}`;
                    workspacePath = path.join(parentRepoPath, finalWorkspaceName);
                    counter++;
                }

                fs.mkdirSync(workspacePath);
                console.log(chalk.green(`✔ Created workspace directory: ${finalWorkspaceName}`));

                const git = simpleGit(workspacePath);
                await git.init();
                console.log(chalk.green(`✔ Initialized Git repository for workspace: ${finalWorkspaceName}`));

                const readmePath = path.join(workspacePath, 'README.md');
                fs.writeFileSync(readmePath, `# ${finalWorkspaceName}`);
                console.log(chalk.green(`✔ Created README.md in workspace: ${finalWorkspaceName}`));

                await git.add(readmePath);
                await git.commit(`${finalWorkspaceName} initial commit`);
                console.log(chalk.green(`✔ Made initial commit in workspace: ${finalWorkspaceName}`));

                if (options.url) {
                    await git.addRemote('origin', options.url);
                    console.log(chalk.green(`✔ Added remote URL: ${options.url}`));
                    const parentGit = simpleGit(parentRepoPath);
                    await parentGit.submoduleAdd(options.url, finalWorkspaceName);
                }
                else {
                    const parentGit = simpleGit(parentRepoPath);
                    await parentGit.submoduleAdd(workspacePath, finalWorkspaceName);

                }

                console.log(chalk.green(`✔ Added workspace as a submodule: ${finalWorkspaceName}`));

                // Commit the creation of the workspace in the parent repository
                await commitChanges(parentRepoPath, `Add workspace: ${finalWorkspaceName}`);

            } catch (error) {
                console.error(chalk.red('✖ Error adding workspace: ') + error.message);
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

                // Step 1: Deinitialize the submodule
                await parentGit.raw(['submodule', 'deinit', '-f', workspaceName]);
                console.log(chalk.green(`✔ Deinitialized submodule: ${workspaceName}`));

                // Step 2: Remove the submodule from the index
                await parentGit.raw(['rm', '-f', workspaceName]);
                console.log(chalk.green(`✔ Removed submodule from index: ${workspaceName}`));

                // Step 3: Remove the submodule's directory from the .git/modules folder
                const submoduleGitPath = path.join(parentRepoPath, '.git/modules', workspaceName);
                if (fs.existsSync(submoduleGitPath)) {
                    fs.rmSync(submoduleGitPath, { recursive: true });
                    console.log(chalk.green(`✔ Deleted submodule Git directory: ${workspaceName}`));
                }

                // Commit the deletion of the workspace in the parent repository
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
                        const parts = line.split(' ');
                        const workspaceName = parts[2]; // The second part is the name

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
                const gitmodulesPath = path.join(parentRepoPath, '.gitmodules');
                let gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
                gitmodulesContent = gitmodulesContent.replace(
                    new RegExp(`\\[submodule "${workspaceName}"\\]([\\s\\S]+?)url = .+`, 'g'),
                    `[submodule "${workspaceName}"]\n\tpath = ${workspaceName}\n\turl = ${remoteUrl}`
                );

                fs.writeFileSync(gitmodulesPath, gitmodulesContent);
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
                const remotes = await git.getRemotes();
                if (!remotes.find(remote => remote.name === 'origin')) {
                    console.error(chalk.red(`✖ Error: No remote origin found for workspace: ${workspaceName}`));
                    return;
                }

                // Remove the remote origin from the submodule
                await git.removeRemote('origin');
                console.log(chalk.green(`✔ Removed remote origin from workspace: ${workspaceName}`));

                // Update the .gitmodules file
                const gitmodulesPath = path.join(parentRepoPath, '.gitmodules');
                let gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
                gitmodulesContent = gitmodulesContent.replace(
                    new RegExp(`\\[submodule "${workspaceName}"\\]([\\s\\S]+?)url = .+`, 'g'),
                    `[submodule "${workspaceName}"]\n\tpath = ${workspaceName}\n\turl = <No remote>`
                );

                fs.writeFileSync(gitmodulesPath, gitmodulesContent);
                console.log(chalk.green(`✔ Updated .gitmodules after removing remote origin for workspace: ${workspaceName}`));

                // Commit changes in parent repository
                await commitChanges(parentRepoPath, `Remove remote origin from workspace: ${workspaceName}`);

            } catch (error) {
                console.error(chalk.red(`✖ Error removing remote: ${error.message}`));
            }
        });
}
