import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { commitChanges } from '../functions/commitHelper.js';  // Import the commit helper
import { isMainNotedRepo } from '../functions/isParent.js';  // Import the isMainNotedRepo helper

export default function foldersCommand(program) {
    const folder = program.command('folder').description('Manage folders within the workspace');

    // Add folder command
    folder
        .command('add [name]')
        .description('Add a new folder inside the workspace')
        .option('-un, --untracked', 'Create the folder without tracking it in Git')
        .action(async (folderName = 'untitled-folder', options) => {
            try {
                const currentDir = process.cwd();  // Current directory
                if (isMainNotedRepo(currentDir)) {
                    console.error(chalk.red('✖ Error: Folders cannot be created in the main Noted repository.'));
                    return;
                }

                // If no folder name is provided, default to "untitled-folder"
                const baseFolderName = folderName || 'untitled-folder';
                let finalFolderName = baseFolderName;
                let folderPath = path.join(currentDir, finalFolderName);

                // Check if folder already exists and increment the name if necessary
                let counter = 1;
                while (fs.existsSync(folderPath)) {
                    finalFolderName = `${baseFolderName}-${counter}`;
                    folderPath = path.join(currentDir, finalFolderName);
                    counter++;
                }

                // Add the folder
                fs.mkdirSync(folderPath);
                console.log(chalk.green(`✔ Added folder: ${finalFolderName}`));

                // Add a `.gitkeep` file inside the folder to ensure Git tracks it
                const gitkeepPath = path.join(folderPath, '.gitkeep');
                fs.writeFileSync(gitkeepPath, '');  // Create an empty .gitkeep file
                console.log(chalk.green(`✔ Created .gitkeep file in folder: ${finalFolderName}`));

                // Check if the folder should be tracked or untracked
                if (!options.untracked) {
                    // Track the folder and commit the changes
                    await commitChanges(currentDir, `Add folder: ${finalFolderName}`);
                } else {
                    console.log(chalk.yellow(`✔ Folder added without tracking: ${finalFolderName}`));
                }

            } catch (error) {
                console.error(chalk.red('✖ Error adding folder: ') + error.message);
            }
        });

    // Delete folder command
    folder
        .command('delete <name>')
        .description('Delete a folder inside the workspace')
        .action(async (folderName) => {
            try {
                const parentRepoPath = process.cwd();
                const folderPath = path.join(parentRepoPath, folderName);

                if (!fs.existsSync(folderPath)) {
                    console.error(chalk.red(`✖ Error: Folder '${folderName}' does not exist.`));
                    return;
                }

                // Use the correct method (fs.rmSync) to delete the folder
                fs.rmSync(folderPath, { recursive: true, force: true });
                console.log(chalk.green(`✔ Deleted folder: ${folderName}`));

                // Commit the deletion
                await commitChanges(parentRepoPath, `Delete folder: ${folderName}`);

            } catch (error) {
                console.error(chalk.red('✖ Error deleting folder: ') + error.message);
            }
        });

    // List folders command
    folder
        .command('list')
        .description('List all folders in the workspace')
        .action(async () => {
            try {
                const parentRepoPath = process.cwd();

                // Read all directories in the workspace
                const items = fs.readdirSync(parentRepoPath, { withFileTypes: true });

                // Filter only directories and exclude hidden ones (those starting with a dot)
                const folders = items.filter(item => item.isDirectory() && !item.name.startsWith('.'));

                if (folders.length === 0) {
                    console.log(chalk.yellow('No folders found.'));
                    return;
                }

                // Display folder names
                folders.forEach(folder => console.log(chalk.blue(folder.name)));

            } catch (error) {
                console.error(chalk.red('✖ Error listing folders: ') + error.message);
            }
        });
}
