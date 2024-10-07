import fs from 'fs';
import path from 'path';

// Helper function to check if we are in the main Noted repository
export function isMainNotedRepo(dir) {
    return fs.existsSync(path.join(dir, '.notedconfig'));
}
