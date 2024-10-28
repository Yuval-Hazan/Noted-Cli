# Noted: A Git-Backed Notes Application

**Noted** is a command-line tool designed for developers and technical users to create, manage, and collaborate on notes with version control through Git. This project provides isolated workspaces, customizable note structures, and security features, making it an ideal tool for managing complex note-taking requirements in a versioned environment.

## Features

- **Workspace Management**: Create isolated Git-backed workspaces for organizing notes (e.g., "Work", "School").
- **Note and Folder Handling**: Create and delete notes within folders, with automated naming and Git tracking.
- **Version Control**: Utilize Git submodules for collaboration, branching, and history tracking within each workspace.
- **Configurable Start Options**: Easily initialize the main *Noted* repository with customizable paths and repository names.
- **Remote Support**: Configure local and remote repositories for both parent and submodules.
- **Command Line Interface (CLI)**: Streamlined commands for an efficient workflow, starting from the CLI with options to expand.

## Getting Started

### Installation

1. Clone the repository:
2. Navigate to the repository:
3. Install dependencies:
   ```bash
   npm install
   ```

### Basic Commands

- **Initialize a Noted Repository**: Start a new *Noted* parent repository in the current directory.
  ```bash
  noted start [options]
  ```
  Options:
  - `--name <name>`: Specify a custom repository name.
  - `--path <path>`: Define a custom path for the repository.
  
- **Manage Workspaces**:
  - Add a new workspace:
    ```bash
    noted workspace add <name>
    ```
  - Delete a workspace:
    ```bash
    noted workspace delete <name>
    ```
  - List all workspaces:
    ```bash
    noted workspace list [-a | -la]
    ```

- **Manage Folders**:
  - Add a new folder:
    ```bash
    noted folder add <folder_name>
    ```
  - Delete a folder:
    ```bash
    noted folder delete <folder_name>
    ```
  - List all folders in the current workspace:
    ```bash
    noted folder list
    ```

- **Create and Delete Notes**:
  - Create a new note:
    ```bash
    noted note add <note_name>
    ```
    Default names follow a sequential format (e.g., `untitled-note-1`, `untitled-note-2`).
  - Delete a note:
    ```bash
    noted note delete <note_name>
    ```

### Configuration

*Noted* includes a hidden `.notedconfig` file generated upon initialization. This file serves as the project's configuration file for managing default settings.

### Example Workflow

1. Initialize the *Noted* repository:
   ```bash
   noted start --name MyNotes --path ~/Documents
   ```
2. Add a workspace for "School":
   ```bash
   noted workspace add School
   ```
3. Create a folder for a course within the "School" workspace:
   ```bash
   noted folder add Calculus
   ```
4. Add a note to the "Calculus" folder:
   ```bash
   noted note add Lecture1
   ```
5. Save and track changes with Git:
   ```bash
   noted save
   ```

## Development

### Project Structure

- **Commands**:
  - `start.js`: Handles the initialization of the *Noted* repository.
  - `workspace.js`: Manages workspace creation, deletion, and listing.
  - `folder.js`: Controls folder operations within workspaces.
  - `note.js`: Manages note creation and deletion.
- **Helpers**:
  - `remoteHelpers.js`: Supports remote configuration for Git repositories.
  - `validations.js`: Includes validation functions for input verification.
  - `getters.js`: Contains helper functions for accessing configurations and settings.

### Dependencies

- `Git`: Version control for workspace management and collaboration.
- `Node.js`: Backend and CLI functionality.
- Additional packages: [Specify here, e.g., Chalk, Inquirer, etc.]

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Create a pull request.

## License

This project is licensed under the MIT License.

## Contact

For questions or feedback, please reach out to the maintainers or submit an issue in the GitHub repository.
