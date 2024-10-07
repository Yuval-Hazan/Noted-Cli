import simpleGit from 'simple-git';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function startCommand(program) {
    program
        .command('start')
        .description('Initialize the main \'Noted\' repository')
        .option('-r, --remote <url>', 'Optional remote URL for the parent repository')
        .action(async (options) => {
            try {
                const repoName = 'Noted';
                const repoPath = path.join(process.cwd(), repoName);

                // Check if the directory already exists
                if (fs.existsSync(repoPath)) {
                    console.error(chalk.red('✖ Error: ') + `Directory "${repoName}" already exists in this location.`);
                    return;
                }

                // Create the repository directory
                fs.mkdirSync(repoPath);
                console.log(chalk.green('✔ Created directory: ') + chalk.blue(repoName));

                // Initialize a Git repository in the created directory
                const git = simpleGit(repoPath);
                await git.init();
                console.log(chalk.green('✔ Initialized a new Git repository.'));

                // If a remote URL is provided, add it to the parent repository
                if (options.remote) {
                    await git.addRemote('origin', options.remote);
                    console.log(chalk.green(`✔ Added remote URL: ${options.remote}`));
                }

                // Read the README.md template file
                const templatePath = path.join(__dirname, '../template/parent-readme.md');
                const readmeContent = fs.readFileSync(templatePath, 'utf-8');
                console.log(chalk.green('✔ Loaded README.md template.'));

                // Write the content to the new README.md file
                fs.writeFileSync(path.join(repoPath, 'README.md'), readmeContent);
                console.log(chalk.green('✔ Created README.md file.'));

                // Create the hidden .notedconfig file
                const configPath = path.join(repoPath, '.notedconfig');
                const configContent = {
                    remote: options.remote || null,
                    createdAt: new Date().toISOString(),
                };
                fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
                console.log(chalk.green('✔ Created .notedconfig file for storing project configurations.'));

                // Stage and commit the README.md and .notedconfig files
                await git.add(['README.md', '.notedconfig']);
                await git.commit('Initial commit: Add README.md and .notedconfig');
                console.log(chalk.green('✔ Created initial commit.'));

                console.log(chalk.green(`\nRepository "${repoName}" is ready! 🎉`));
            } catch (error) {
                console.error(chalk.red('✖ Error initializing repository: ') + error.message);
            }
        });
}
