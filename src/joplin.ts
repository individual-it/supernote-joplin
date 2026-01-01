import joplin from "../api";
import path = require('path');

/**
 * creates the notebook structure in Joplin that is parallel to the folder structure of the .note files
 * returns the id of the final notebook to store the note in
 * @param noteFile
 * @param destinationNotebookId
 */

export async function createJoplinNotebookStructure(noteFile: string, destinationNotebookId: string): Promise<string> {
    const allNotebooks = await joplin.data.get(['folders']);
    const notePath = path.dirname(noteFile);
    const noteFolders = notePath === '.' ? [] : notePath.split(path.sep);
    for (const folder of noteFolders) {
        const matchingNotebook = allNotebooks.items.find(
            item => item.parent_id === destinationNotebookId && item.title === folder
        );
        if (matchingNotebook) {
            destinationNotebookId = matchingNotebook.id;
        } else {
            const newNotebook = await joplin.data.post(
                ['folders'], null, {parent_id: destinationNotebookId, title: folder}
            );
            destinationNotebookId = newNotebook.id;
        }
    }
    return destinationNotebookId;
}

