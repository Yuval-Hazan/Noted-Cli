import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';

export function isMainNotedRepo(dir) {
    return fs.existsSync(path.join(dir, '.notedconfig'));
}

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

export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}
