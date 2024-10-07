import simpleGit from 'simple-git';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Helper function to find the root of the workspace (submodule)
function findWorkspaceRoot(currentPath) {
    let workspaceRoot = currentPath;

    while (!fs.existsSync(path.join(workspaceRoot, '.git'))) {
        const parentPath = path.dirname(workspaceRoot);
        if (parentPath === workspaceRoot) {
            return null;  // We've reached the root of the filesystem without finding a workspace
        }
        workspaceRoot = parentPath;
    }

    return workspaceRoot;
}

// Helper function to check if current directory is inside a submodule
async function isSubmodule(repoPath) {
    const git = simpleGit(repoPath);
    try {
        const result = await git.raw(['rev-parse', '--show-superproject-working-tree']);
        if (result && result.trim()) {
            return result.trim();  // Return the parent repository path (i.e., Noted repository)
        }
    } catch (error) {
        return null;  // If not a submodule
    }
}

// Helper function to handle submodule changes
async function handleSubmoduleChanges(submoduleRepoPath) {
    const git = simpleGit(submoduleRepoPath);

    try {
        const remotes = await git.getRemotes(true);
        const hasOrigin = remotes.some(remote => remote.name === 'origin');

        if (hasOrigin) {
            console.log(chalk.blue(`✔ Submodule "${path.basename(submoduleRepoPath)}" has origin.`));

            // Stage, commit, and push changes in submodule
            await git.add('.');
            const changesSummary = await git.status();
            const commitMessage = `Updated submodule "${path.basename(submoduleRepoPath)}" with ${changesSummary.created.length} new files, ${changesSummary.modified.length} modified files, and ${changesSummary.deleted.length} deleted files.`;
            await git.commit(commitMessage);
            console.log(chalk.green(`✔ Committed changes in submodule "${path.basename(submoduleRepoPath)}": ${commitMessage}`));

            await git.push('origin', 'main');
            console.log(chalk.green(`✔ Pushed changes in submodule "${path.basename(submoduleRepoPath)}" to origin.`));
        } else {
            console.log(chalk.yellow(`⚠ Submodule "${path.basename(submoduleRepoPath)}" has no origin. Skipping push.`));
        }
    } catch (error) {
        console.error(chalk.red(`✖ Error handling submodule changes: ${error.message}`));
    }
}

// Helper function to commit and push changes in the parent repository
async function updateParentRepository(parentRepoPath, submodulePaths) {
    const parentGit = simpleGit(parentRepoPath);

    try {
        // Stage each updated submodule
        for (const submodulePath of submodulePaths) {
            const submoduleName = path.basename(submodulePath);
            await parentGit.add(submoduleName);
            console.log(chalk.green(`✔ Staged submodule "${submoduleName}" in parent repository.`));
        }

        // Commit the staged changes in the parent repository
        const commitMessage = `Updated submodules: ${submodulePaths.map(p => path.basename(p)).join(', ')} to latest commit in parent repository.`;
        await parentGit.commit(commitMessage);
        console.log(chalk.green(`✔ Committed submodule changes in parent repository: ${commitMessage}`));

        // Check if parent repo has a remote origin
        const remotes = await parentGit.getRemotes(true);
        const hasOrigin = remotes.some(remote => remote.name === 'origin');

        if (hasOrigin) {
            await parentGit.push('origin', 'main');
            console.log(chalk.green('✔ Pushed changes in parent repository to origin.'));
        } else {
            console.log(chalk.yellow('⚠ Parent repository has no origin. Skipping push.'));
        }
    } catch (error) {
        console.error(chalk.red(`✖ Error committing changes in parent repository: ${error.message}`));
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

export default async function uploadCommand(program) {
    program
        .command('upload')
        .description('Upload changes from a submodule (workspace) or all submodules using --all')
        .option('--all', 'Upload changes from all submodules')
        .action(async (options) => {
            const currentRepoPath = process.cwd();
            const workspaceRoot = findWorkspaceRoot(currentRepoPath);

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
                        console.error(chalk.red('✖ Error: The --all option can only be run from the parent Noted repository.'));
                        return;
                    }

                    console.log(chalk.green('✔ Parent repository detected.'));
                    const submodules = getSubmodules(parentRepoPath);

                    if (submodules.length === 0) {
                        console.log(chalk.yellow('⚠ No submodules found in the parent repository.'));
                        return;
                    }

                    // Handle changes for each submodule
                    for (const submodulePath of submodules) {
                        console.log(chalk.blue(`Processing submodule: ${path.basename(submodulePath)}`));
                        await handleSubmoduleChanges(submodulePath);
                    }

                    // Commit and push changes in the parent repository after all submodules are processed
                    await updateParentRepository(parentRepoPath, submodules);
                } else {
                    // Check if we are in a submodule (workspace)
                    const parentRepoPath = await isSubmodule(workspaceRoot);

                    if (!parentRepoPath) {
                        console.error(chalk.red('✖ Error: Upload can only be run inside a workspace (submodule).'));
                        return;
                    }

                    console.log(chalk.green('✔ Workspace detected.'));

                    // Handle submodule (workspace) changes
                    await handleSubmoduleChanges(workspaceRoot);

                    // Update the parent repository with the submodule changes
                    const submoduleName = path.basename(workspaceRoot);
                    await updateParentRepository(parentRepoPath, [workspaceRoot]);  // Pass an array with a single submodule
                }

            } catch (error) {
                console.error(chalk.red(`✖ Error during upload process: ${error.message}`));
            }
        });
}

