import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';

export default function navCommand(program) {
    program
        .command('nav [scope]')
        .description('Navigate through Workspaces, Folders, and Notes')
        .action((scope) => {
            if (scope === 'all') {
                navigateFromRoot();  // Start from the Noted repo root
            } else if (scope === 'workspace') {
                navigateFromWorkspace();  // Start from the workspace root
            } else {
                navigateFromCurrentDir();  // Default to starting from the current directory
            }
        });
}

// Helper to get directories (i.e., workspaces or folders), excluding hidden directories
const getDirectories = (source) =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.')) // Exclude hidden folders
        .map((dirent) => dirent.name);

// Helper to get notes (Markdown files), excluding hidden files
const getNotes = (source) =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.md') && !dirent.name.startsWith('.')) // Exclude hidden files
        .map((dirent) => dirent.name);

// Function to detect the root of the Noted repository (by checking for .notedconfig file)
function getNotedRepoRoot(currentDir) {
    let dir = currentDir;
    while (dir !== '/') {
        if (fs.existsSync(path.join(dir, '.notedconfig'))) {
            return dir;  // Found the Noted repository root
        }
        dir = path.dirname(dir);
    }
    return null;  // No Noted repo root found
}

// Function to detect the workspace root (by checking for .git directory)
function getWorkspaceRoot(currentDir) {
    let dir = currentDir;
    while (dir !== '/') {
        if (fs.existsSync(path.join(dir, '.git'))) {
            return dir;  // Found the workspace root
        }
        dir = path.dirname(dir);
    }
    return null;  // No workspace root found
}

// Function to open a folder in Finder (macOS) or Files (Linux)
function openFolderInFinder(folderPath) {
    const platform = process.platform;
    if (platform === 'darwin') {
        exec(`open "${folderPath}"`);  // macOS
    } else if (platform === 'linux') {
        exec(`xdg-open "${folderPath}"`);  // Linux
    } else {
        console.log(chalk.red('Opening folders is not supported on this OS.'));
    }
}

// Function to open a Markdown file in the default editor
function openNoteInEditor(notePath) {
    const platform = process.platform;
    if (platform === 'darwin') {
        exec(`open "${notePath}"`);  // macOS opens in the default text editor
    } else if (platform === 'linux') {
        exec(`xdg-open "${notePath}"`);  // Linux opens in the default text editor
    } else {
        console.log(chalk.red('Opening files is not supported on this OS.'));
    }
}

// Function to navigate from the current directory
function navigateFromCurrentDir() {
    const currentDir = process.cwd();
    console.log(chalk.green(`Starting from the current directory: ${currentDir}`));
    navigateFolders(currentDir, path.basename(currentDir));  // Start navigating from the current directory
}

// Function to navigate from the Noted repository root
function navigateFromRoot() {
    const notedRoot = getNotedRepoRoot(process.cwd());
    if (!notedRoot) {
        console.log(chalk.red('Noted repository root not found.'));
        return;
    }
    console.log(chalk.green(`Starting from the Noted repository root: ${notedRoot}`));
    navigateFolders(notedRoot, 'Noted Root');
}

// Function to navigate from the workspace root
function navigateFromWorkspace() {
    const workspaceRoot = getWorkspaceRoot(process.cwd());
    if (!workspaceRoot) {
        console.log(chalk.red('Workspace root not found.'));
        return;
    }
    console.log(chalk.green(`Starting from the workspace root: ${workspaceRoot}`));
    navigateFolders(workspaceRoot, path.basename(workspaceRoot));
}

// Function to navigate folders and notes inside a workspace
async function navigateFolders(currentPath, currentFolder) {
    const folders = getDirectories(currentPath);  // Get directories (folders)
    const notes = getNotes(currentPath);  // Get notes (Markdown files)

    const choices = [...folders.map(f => `📂 ${f}`), ...notes.map(n => `📝 ${n}`), 'Go Back', 'Exit'];

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'selection',
            message: `You are in "${currentFolder}". Choose an option:`,
            choices
        }
    ]);

    // Go back to the parent directory or main menu
    if (answers.selection === 'Go Back') {
        if (currentPath === process.cwd()) {
            return navigateWorkspaces();  // Go back to workspace selection if at the root
        } else {
            const parentPath = path.dirname(currentPath);  // Navigate to the parent folder
            const parentFolder = path.basename(parentPath);
            return navigateFolders(parentPath, parentFolder);  // Navigate to the parent folder
        }
    }

    // Exit the navigation
    if (answers.selection === 'Exit') {
        console.log(chalk.green('Exiting...'));
        return;
    }

    // Navigate into a folder
    if (answers.selection.startsWith('📂')) {
        const folderName = answers.selection.replace('📂 ', '');
        const newPath = path.join(currentPath, folderName);

        const folderAction = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `You selected folder "${folderName}". What would you like to do?`,
                choices: ['Open in Finder', 'Navigate Inside', 'Go Back', 'Exit']
            }
        ]);

        if (folderAction.action === 'Open in Finder') {
            openFolderInFinder(newPath);  // Open folder in Finder or Files
        } else if (folderAction.action === 'Navigate Inside') {
            return navigateFolders(newPath, folderName);  // Navigate into the selected folder
        } else if (folderAction.action === 'Exit') {
            console.log(chalk.green('Exiting...'));
        } else {
            return navigateFolders(currentPath, currentFolder);  // Go back to current folder
        }
    }

    // View a note
    if (answers.selection.startsWith('📝')) {
        const noteName = answers.selection.replace('📝 ', '');
        const notePath = path.join(currentPath, noteName);

        const noteAction = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `You selected note "${noteName}". What would you like to do?`,
                choices: ['Open in Text Editor', 'Go Back', 'Exit']
            }
        ]);

        if (noteAction.action === 'Open in Text Editor') {
            openNoteInEditor(notePath);  // Open the note in the default text editor
        } else if (noteAction.action === 'Exit') {
            console.log(chalk.green('Exiting...'));
        } else {
            return navigateFolders(currentPath, currentFolder);  // Go back to the folder
        }
    }
}
