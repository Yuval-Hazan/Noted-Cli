import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';

// Helper function to determine if we are inside a submodule
export async function isSubmodule(repoPath) {
    const git = simpleGit(repoPath);
    try {
        const result = await git.raw(['rev-parse', '--show-superproject-working-tree']);
        if (result && result.trim()) {
            return result.trim(); // Return the parent repository path
        }
    } catch (error) {
        // If the command fails, we are not in a submodule
    }
    return null;
}

export async function commitChanges(currentPath, commitMessage, branchName = 'main') {
    try {
        const git = simpleGit(currentPath);

        // Determine the root of the repository
        const repoRoot = await git.revparse(['--show-toplevel']);
        const repoGit = simpleGit(repoRoot);

        // Ensure we are on the correct branch
        const currentBranch = await repoGit.revparse(['--abbrev-ref', 'HEAD']);
        if (currentBranch.trim() === 'HEAD') {
            // We are in a detached HEAD state, check out the branch
            try {
                await repoGit.checkout(branchName);
                console.log(chalk.green(`✔ Checked out branch '${branchName}' in ${repoRoot}`));
            } catch (error) {
                // Branch doesn't exist, create it
                await repoGit.checkoutLocalBranch(branchName);
                console.log(chalk.green(`✔ Created and checked out new branch '${branchName}' in ${repoRoot}`));
            }
        }

        // Calculate the relative path from repo root to current path
        const relativePath = path.relative(repoRoot, currentPath) || '.';

        // Stage all changes from the current directory
        await repoGit.add(`${relativePath}/.`);
        console.log(chalk.green('✔ Staged changes from current directory.'));

        // Commit the staged changes
        await repoGit.commit(commitMessage);
        console.log(chalk.green(`✔ Committed changes: "${commitMessage}" to ${repoRoot}`));

        // Check if we are in a submodule
        const parentRepoPath = await isSubmodule(repoRoot);

        if (parentRepoPath) {
            // We are in a submodule; update the parent repository
            console.log(chalk.green(`✔ Detected submodule. Updating parent repository at ${parentRepoPath}`));

            const parentGit = simpleGit(parentRepoPath);

            // Stage the submodule directory in the parent repository
            const submoduleName = path.basename(repoRoot);
            await parentGit.add(`./${submoduleName}`);
            console.log(chalk.green(`✔ Staged submodule '${submoduleName}' in parent repository.`));

            // Commit the submodule update in the parent repository
            await parentGit.commit(`Update submodule: "${submoduleName}" - ${commitMessage}`);
            console.log(chalk.green(`✔ Committed submodule update for '${submoduleName}' to parent repository at ${parentRepoPath}.`));
        } else {
            console.log(chalk.green('✔ No parent repository update needed.'));
        }
    } catch (error) {
        console.error(chalk.red(`✖ Error committing changes: ${error.message}`));
    }
}
