import simpleGit from 'simple-git';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { commitChanges, isSubmodule } from '../functions/commitHelper.js'; // Corrected import

// Helper function to find the root of the workspace (submodule)
async function findWorkspaceRoot(currentPath) {
    const git = simpleGit(currentPath);
    try {
        const repoRoot = await git.revparse(['--show-toplevel']);
        return repoRoot;
    } catch (error) {
        return null; // Not inside a Git repository
    }
}

// Helper function to get all submodules in the parent repository
function getSubmodules(parentRepoPath) {
    const gitmodulesPath = path.join(parentRepoPath, '.gitmodules');

    // Check if the .gitmodules file exists
    if (!fs.existsSync(gitmodulesPath)) {
        console.log('No submodules found. .gitmodules file does not exist.');
        return [];
    }

    const gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
    const submodulePaths = [];

    // Regex to capture paths from .gitmodules
    const regex = /path\s*=\s*(.+)/g;
    let match;

    // Iterate through all matches of "path = ..." in the .gitmodules file
    while ((match = regex.exec(gitmodulesContent)) !== null) {
        const submoduleRelativePath = match[1].trim(); // Extract and trim the submodule path
        const submoduleAbsolutePath = path.join(parentRepoPath, submoduleRelativePath);
        submodulePaths.push(submoduleAbsolutePath);
    }

    if (submodulePaths.length === 0) {
        console.log('No submodules found in .gitmodules.');
    } else {
        console.log(`Found ${submodulePaths.length} submodule(s).`);
    }

    return submodulePaths;
}

export default function updateCommand(program) {
    program
        .command('update')
        .description('Update changes from a workspace or all workspaces using --all')
        .option('--all', 'Update changes from all workspaces')
        .action(async (options) => {
            const currentRepoPath = process.cwd();
            const workspaceRoot = await findWorkspaceRoot(currentRepoPath);

            if (!workspaceRoot) {
                console.error(chalk.red('✖ Error: Could not find the root of the workspace. Make sure you are inside a workspace.'));
                return;
            }

            try {
                // Check if the --all flag is provided
                if (options.all) {
                    // Ensure we are in the parent repository
                    const parentRepoPath = workspaceRoot;
                    if (!fs.existsSync(path.join(parentRepoPath, '.notedconfig'))) {
                        console.error(chalk.red('✖ Error: The --all option can only be run from the main Noted repository.'));
                        return;
                    }

                    console.log(chalk.green('✔ Parent repository detected.'));
                    const submodules = getSubmodules(parentRepoPath);

                    if (submodules.length === 0) {
                        console.log(chalk.yellow('⚠ No workspaces (submodules) found in the parent repository.'));
                        return;
                    }

                    // Handle changes for each submodule
                    for (const submodulePath of submodules) {
                        console.log(chalk.blue(`Processing workspace: ${path.basename(submodulePath)}`));

                        // Initialize Git in the submodule
                        const git = simpleGit(submodulePath);

                        // Check for changes and unpushed commits in the submodule
                        const status = await git.status();
                        const hasChanges = !status.isClean();
                        const hasUnpushedCommits = status.ahead > 0;

                        // Check if submodule has a remote origin
                        const remotes = await git.getRemotes(true);
                        const hasOrigin = remotes.some(remote => remote.name === 'origin');

                        if (hasChanges) {
                            // Use commitChanges to handle commits and updates
                            await commitChanges(submodulePath, `Update workspace: ${path.basename(submodulePath)}`);
                        } else {
                            console.log(chalk.yellow(`⚠ No changes to commit in workspace "${path.basename(submodulePath)}".`));
                        }

                        if (hasOrigin) {
                            if (hasUnpushedCommits || hasChanges) {
                                // Push changes to the remote
                                await git.push('origin', 'main');
                                console.log(chalk.green(`✔ Pushed changes in workspace "${path.basename(submodulePath)}" to origin.`));
                            } else {
                                console.log(chalk.yellow(`⚠ No new commits to push in workspace "${path.basename(submodulePath)}".`));
                            }
                        } else {
                            console.log(chalk.yellow(`⚠ Workspace "${path.basename(submodulePath)}" has no remote origin. Skipping push.`));
                        }
                    }

                    // Commit and push changes in the parent repository after all submodules are processed
                    const parentGit = simpleGit(parentRepoPath);

                    // Check for changes and unpushed commits in the parent repository
                    const parentStatus = await parentGit.status();
                    const parentHasChanges = !parentStatus.isClean();
                    const parentHasUnpushedCommits = parentStatus.ahead > 0;

                    if (parentHasChanges) {
                        // Use commitChanges to handle commits
                        await commitChanges(parentRepoPath, `Update workspaces to latest commits`);
                    } else {
                        console.log(chalk.yellow('⚠ No changes to commit in parent repository.'));
                    }

                    // Check if parent repo has a remote origin
                    const parentRemotes = await parentGit.getRemotes(true);
                    const parentHasOrigin = parentRemotes.some(remote => remote.name === 'origin');

                    if (parentHasOrigin) {
                        if (parentHasUnpushedCommits || parentHasChanges) {
                            await parentGit.push('origin', 'main');
                            console.log(chalk.green('✔ Pushed changes in parent repository to origin.'));
                        } else {
                            console.log(chalk.yellow('⚠ No new commits to push in parent repository.'));
                        }
                    } else {
                        console.log(chalk.yellow('⚠ Parent repository has no remote origin. Skipping push.'));
                    }

                } else {
                    // Check if we are in a submodule (workspace)
                    const parentRepoPath = await isSubmodule(workspaceRoot);

                    if (!parentRepoPath) {
                        console.error(chalk.red('✖ Error: Update can only be run inside a workspace (submodule).'));
                        return;
                    }

                    console.log(chalk.green('✔ Workspace detected.'));

                    // Initialize Git in the workspace
                    const git = simpleGit(workspaceRoot);

                    // Check for changes and unpushed commits in the workspace
                    const status = await git.status();
                    const hasChanges = !status.isClean();
                    const hasUnpushedCommits = status.ahead > 0;

                    // Check if workspace has a remote origin
                    const remotes = await git.getRemotes(true);
                    const hasOrigin = remotes.some(remote => remote.name === 'origin');

                    if (hasChanges) {
                        // Use commitChanges to handle commits and updates
                        await commitChanges(workspaceRoot, `Update workspace: ${path.basename(workspaceRoot)}`);
                    } else {
                        console.log(chalk.yellow('⚠ No changes to commit in the workspace.'));
                    }

                    if (hasOrigin) {
                        if (hasUnpushedCommits || hasChanges) {
                            // Push changes to the remote
                            await git.push('origin', 'main');
                            console.log(chalk.green('✔ Pushed changes in workspace to origin.'));
                        } else {
                            console.log(chalk.yellow('⚠ No new commits to push in workspace.'));
                        }
                    } else {
                        console.log(chalk.yellow('⚠ Workspace has no remote origin. Skipping push.'));
                    }

                    // Commit and push changes in the parent repository
                    const parentGit = simpleGit(parentRepoPath);

                    // Check for changes and unpushed commits in the parent repository
                    const parentStatus = await parentGit.status();
                    const parentHasChanges = !parentStatus.isClean();
                    const parentHasUnpushedCommits = parentStatus.ahead > 0;

                    if (parentHasChanges) {
                        // Use commitChanges to handle commits
                        await commitChanges(parentRepoPath, `Update workspace: ${path.basename(workspaceRoot)} to latest commit`);
                    } else {
                        console.log(chalk.yellow('⚠ No changes to commit in parent repository.'));
                    }

                    // Check if parent repo has a remote origin
                    const parentRemotes = await parentGit.getRemotes(true);
                    const parentHasOrigin = parentRemotes.some(remote => remote.name === 'origin');

                    if (parentHasOrigin) {
                        if (parentHasUnpushedCommits || parentHasChanges) {
                            await parentGit.push('origin', 'main');
                            console.log(chalk.green('✔ Pushed changes in parent repository to origin.'));
                        } else {
                            console.log(chalk.yellow('⚠ No new commits to push in parent repository.'));
                        }
                    } else {
                        console.log(chalk.yellow('⚠ Parent repository has no remote origin. Skipping push.'));
                    }
                }

            } catch (error) {
                console.error(chalk.red(`✖ Error during update process: ${error.message}`));
            }
        });
}
