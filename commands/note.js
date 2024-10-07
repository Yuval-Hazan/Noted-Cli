import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import { commitChanges } from '../functions/commitHelper.js'; // Import the commit helper
import { isMainNotedRepo } from '../functions/isParent.js'; // Import the isMainNotedRepo helper

export default function noteCommand(program) {
    const note = program.command('note').description('Manage notes inside the current workspace');

    // Add note command
    note
        .command('add [note]')
        .description('Add a new note in the current workspace (default name: untitled-note)')
        .option('-u, --untracked', 'Create an untracked note')
        .action(async (noteName = 'untitled-note', options) => {
            try {
                const currentDir = process.cwd();

                // Check if we're in the main Noted repository
                if (isMainNotedRepo(currentDir)) {
                    console.error(chalk.red('✖ Error: Notes cannot be created in the main Noted repository.'));
                    return;
                }

                // Handle the incrementing note name logic
                let baseNoteName = noteName;
                let finalNoteName = baseNoteName;
                let notePath = path.join(currentDir, `${finalNoteName}.md`);

                let counter = 1;
                while (fs.existsSync(notePath)) {
                    finalNoteName = `${baseNoteName}-${counter}`;
                    notePath = path.join(currentDir, `${finalNoteName}.md`);
                    counter++;
                }

                // Create the note (Markdown file)
                fs.writeFileSync(notePath, `# ${finalNoteName}\n`);
                console.log(chalk.green(`✔ Created note: ${finalNoteName} in the current workspace`));

                // Track the note in Git by default unless the --untracked option is specified
                if (!options.untracked) {
                    await commitChanges(currentDir, `Add note: ${finalNoteName}`);
                } else {
                    console.log(chalk.yellow(`✔ Created untracked note: ${finalNoteName}`));
                }

            } catch (error) {
                console.error(chalk.red('✖ Error adding note: ') + error.message);
            }
        });

    // Delete note command
    note
        .command('delete <note>')
        .description('Delete a note from the current workspace')
        .action(async (noteName) => {
            try {
                const currentDir = process.cwd();

                // Check for both the note with and without the .md extension
                let notePath = path.join(currentDir, `${noteName}`);
                if (!noteName.endsWith('.md')) {
                    notePath = path.join(currentDir, `${noteName}.md`);
                }

                // If the note exists, delete it
                if (!fs.existsSync(notePath)) {
                    console.error(chalk.red(`✖ Error: Note '${noteName}' does not exist.`));
                    return;
                }

                // Delete the note
                fs.rmSync(notePath);
                console.log(chalk.green(`✔ Deleted note: ${noteName.replace('.md', '')}`));

                // Commit the deletion
                await commitChanges(currentDir, `Delete note: ${noteName}`);

            } catch (error) {
                console.error(chalk.red('✖ Error deleting note: ') + error.message);
            }
        });

    // List notes command
    note
        .command('list')
        .description('List all notes in the current workspace')
        .action(async () => {
            try {
                const currentDir = process.cwd();

                // List all Markdown files (notes) in the current directory
                const items = fs.readdirSync(currentDir, { withFileTypes: true });
                const notes = items.filter(item => item.isFile() && item.name.endsWith('.md'));

                if (notes.length === 0) {
                    console.log(chalk.yellow('No notes found in the current workspace.'));
                    return;
                }

                // Display note names
                notes.forEach(note => console.log(chalk.blue(note.name.replace('.md', ''))));

            } catch (error) {
                console.error(chalk.red('✖ Error listing notes: ') + error.message);
            }
        });
}
