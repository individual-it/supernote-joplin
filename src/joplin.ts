import joplin from "../api";
import * as imagejs from "image-js"
import {SupernoteX, toImage} from "supernote-typescript";
import path = require('path');
import fs = require('fs');

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

export async function findMatchingNote(destinationNotebookId: string, noteFile: string,): Promise<any> {
    const title = path.basename(noteFile, '.note');
    const notesInDestinationFolder = await joplin.data.get(['folders', destinationNotebookId, 'notes']);
    const matchingNote = notesInDestinationFolder.items.find(
        item => item.title === title
    );
    if (matchingNote) {
        return await joplin.data.get(['notes', matchingNote.id], { fields: ['id', 'title', 'updated_time'] });
    }
    return null;
}

export async function writeNote(destinationNotebookId: string, matchingNote, noteFile: string, body: string): Promise<void> {
    const title = path.basename(noteFile, '.note');
    const notesInDestinationFolder = await joplin.data.get(['folders', destinationNotebookId, 'notes']);
    if (matchingNote) {
        await joplin.data.put(['notes', matchingNote.id], null, {body, title});
    } else {
        await joplin.data.post(['notes'], null, {parent_id: destinationNotebookId, body, title});
    }
}

export async function createResources(sn: SupernoteX, tmpFolder: string, noteFile: string) {
    let images = await toImage(sn)
    const createdResources = [];
    for await (const [index, image] of images.entries()) {
        const fileName = `${noteFile}-${index}.png`;
        const fullOutputPath = path.join(tmpFolder, fileName);

        const outputDirName = path.dirname(fullOutputPath);
        if (!fs.existsSync(outputDirName)) {
            fs.mkdirSync(outputDirName, {recursive: true});
        }
        try {
            imagejs.writeSync(fullOutputPath, image)
        } catch (e) {
            console.error(e)
        }
        const resource = await joplin.data.post(
            ["resources"],
            null,
            {title: fileName}, // Resource metadata
            [
                {
                    path: fullOutputPath, // Actual file
                },
            ]
        );
        createdResources.push(resource);
    }
    return createdResources;

}
