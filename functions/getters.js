import inquirer from 'inquirer';
import { isValidUrl } from './validations.js';
import path from 'path';
import fs from 'fs';


export async function getRepoName(options) {
    if (options.name) {
        return options.name;
    }
    const { chosenRepoName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'chosenRepoName',
            message: 'Enter a name for the repository:',
            default: 'Noted',
        }
    ]);
    return chosenRepoName;
}

export async function getWorkspaceName(options, parentRepoPath) {
    let workspaceName = options.name || 'untitled-workspace';

    if (!options.name) {
        const { chosenWorkspaceName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'chosenWorkspaceName',
                message: 'Enter a name for the workspace:',
                default: 'untitled-workspace',
            }
        ]);
        workspaceName = chosenWorkspaceName;
    }

    let workspacePath = path.join(parentRepoPath, workspaceName);
    let counter = 1;
    const baseName = workspaceName;

    while (fs.existsSync(workspacePath)) {
        workspaceName = `${baseName}-${counter}`;
        workspacePath = path.join(parentRepoPath, workspaceName);
        counter++;
    }

    return workspaceName;
}

// Export other functions
export async function getRepoType(options) {
    if (options.local) {
        return 'Local';
    }
    if (options.remote) {
        return 'Remote';
    }
    const { repoType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'repoType',
            message: 'Do you want to create a local or remote repository?',
            choices: ['Local', 'Remote']
        }
    ]);
    return repoType;
}

export async function getRemoteOption(options, repoType) {
    if (repoType === 'Remote') {
        if (options.remote) {
            return options.remote;
        }
        const { remoteOption } = await inquirer.prompt([
            {
                type: 'list',
                name: 'remoteOption',
                message: 'How would you like to configure the remote repository?',
                choices: ['GitHub (new)', 'Manual URL']
            }
        ]);

        if (remoteOption === 'GitHub (new)') {
            return 'new';
        } else {
            const { manualUrl } = await inquirer.prompt({
                type: 'input',
                name: 'manualUrl',
                message: 'Enter remote URL:',
                validate: (input) => {
                    if (isValidUrl(input)) {
                        return true;
                    }
                    return 'Please enter a valid URL';
                }
            });
            return manualUrl;
        }
    }
    return null; // For local repositories
}
