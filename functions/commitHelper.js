import simpleGit from 'simple-git';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Helper function to determine if we are inside a submodule
async function isSubmodule(repoPath) {
    const git = simpleGit(repoPath);
    try {
        // This command returns the superproject’s working directory if in a submodule
        const result = await git.raw(['rev-parse', '--show-superproject-working-tree']);
        if (result && result.trim()) {
            return result.trim();  // Return the parent repository path
        }
    } catch (error) {
        // If the command fails, we are not in a submodule
    }
    return null;
}

export async function commitChanges(repoPath, commitMessage) {
    try {
        const git = simpleGit(repoPath);

        // Stage all changes in the current submodule (e.g., myWorkspace)
        await git.add('.');
        console.log(chalk.green('✔ Staged all changes in the current workspace.'));

        // Commit the staged changes in the submodule
        await git.commit(commitMessage);
        console.log(chalk.green(`✔ Committed changes: "${commitMessage}" to ${repoPath}`));

        // Now, check if we are in a submodule
        const parentRepoPath = await isSubmodule(repoPath);

        if (parentRepoPath) {
            // We are in a submodule; now update the parent repository (Noted)
            console.log(chalk.green(`✔ Detected submodule. Updating parent repository at ${parentRepoPath}`));

            // Initialize Git for the parent repository (Noted)
            const parentGit = simpleGit(parentRepoPath);

            // Get the name of the submodule (e.g., myWorkspace)
            const submoduleName = path.basename(repoPath);

            // Stage the submodule directory (myWorkspace) in the parent repository (Noted)
            await parentGit.add(parentRepoPath);
            console.log(chalk.green(`✔ Staged submodule '${submoduleName}' in parent repository.`));

            // Commit the submodule update in the parent repository (Noted)
            await parentGit.commit(`Update submodule: "${submoduleName}" to latest commit in workspace: "${commitMessage}"`);
            console.log(chalk.green(`✔ Committed submodule update for '${submoduleName}' to parent repository at ${parentRepoPath}.`));
        } else {
            console.log(chalk.green('✔ No parent repository update needed.'));
        }
    } catch (error) {
        console.error(chalk.red(`✖ Error committing changes: ${error.message}`));
    }
}
