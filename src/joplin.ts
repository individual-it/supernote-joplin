import joplin from "../api";
import * as imagejs from "image-js"
import {SupernoteX, toImage} from "supernote-typescript";
import {ToastType} from "../api/types";
import fs from 'fs';
import path from 'path';
import url from 'url';
import querystring from 'querystring';

export interface Note {
    id: string;
    title: string;
    updated_time: number;
}

export interface Notebook {
    id: string,
    parent_id: string,
    title: string,
}


export async function getDestinationRootNotebook(destinationNotebookExternalLink: string): Promise<string> {
    const destinationNotebookURL = url.parse(destinationNotebookExternalLink)
    const destinationNotebook = querystring.parse(destinationNotebookURL.query);
    let checkDestinationNotebookResponse = null;
    let checkDestinationNotebookError= null;
    if (destinationNotebook.id && !Array.isArray(destinationNotebook.id)) {
        try {
            checkDestinationNotebookResponse = await joplin.data.get(['folders', destinationNotebook.id]);
        } catch (e) {
            checkDestinationNotebookError = e.message;
        }

    }
    if (!checkDestinationNotebookResponse || checkDestinationNotebookError || Array.isArray(destinationNotebook.id)) {
        let message = "Could not find the Joplin notebook for synchronisation. " +
            "Please copy the external link of the notebook you want to use " +
            "and paste it into the 'Joplin Notebook' setting."
        await showMessage(
            ToastType.Error,
            message
        );
        message += ` DEBUG: ${checkDestinationNotebookError}`
        throw new Error(message);
    }
    return destinationNotebook.id;
}

export async function showMessage(type: ToastType, messageForUser: string, duration?: number): Promise<void> {
    const message="Supernote Sync: " + messageForUser;
    const dialogs = joplin.views.dialogs;
    if (duration === null) {
        duration = 1000 * 60;
    }
    await dialogs.showToast({
        message: message,
        duration: duration,
        type: type
    })

}
/**
 * creates the notebook structure in Joplin that is parallel to the folder structure of the .note files
 * returns the id of the final notebook to store the note in
 * @param noteFile
 * @param destinationNotebookId
 */

export async function createJoplinNotebookStructure(noteFile: string, destinationNotebookId: string): Promise<string> {
    let allNotebooks: Notebook[] = [];
    let response: { items: Notebook[]; has_more: boolean; };
    let pageNum = 1;
    do {
        response = await joplin.data.get(['folders'], {page: pageNum++});
        allNotebooks = [...response.items, ...allNotebooks];
    } while (response.has_more)
    const notePath = path.dirname(noteFile);
    const noteFolders = notePath === '.' ? [] : notePath.split(path.sep);
    for (const folder of noteFolders) {
        const matchingNotebook = allNotebooks.find(
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

export async function findMatchingNote(destinationNotebookId: string, noteFile: string,): Promise<Note> {
    const title = path.basename(noteFile, '.note');
    let response: { items: []; has_more: boolean; };
    let notesInDestinationFolder: Note[] = [];
    let pageNum = 1;
    do {
        response = await joplin.data.get(['folders', destinationNotebookId, 'notes'], {page: pageNum++});
        notesInDestinationFolder = [...response.items, ...notesInDestinationFolder];
    } while (response.has_more)

    const matchingNote = notesInDestinationFolder.find(
        item => item.title === title
    );
    if (matchingNote) {
        return await joplin.data.get(['notes', matchingNote.id], { fields: ['id', 'title', 'updated_time'] });
    }
    return null;
}

export async function writeNote(destinationNotebookId: string, matchingNote, noteFile: string, body: string): Promise<void> {
    const title = path.basename(noteFile, '.note');
    if (matchingNote) {
        let response: { items: []; has_more: boolean; };
        let existingResources = [];
        let pageNum = 1;
        do {
            response = await joplin.data.get(['notes', matchingNote.id, 'resources'], {page: pageNum++});
            existingResources = [...response.items, ...existingResources]
        } while (response.has_more)
        for (const resource of existingResources) {
            const associatedNotes = await joplin.data.get(['resources', resource.id, 'notes']);
            if (associatedNotes.items.length === 1 && associatedNotes.items[0].id === matchingNote.id) {
                await joplin.data.delete(['resources', resource.id]);
            }
        }
        await joplin.data.put(['notes', matchingNote.id], null, {body, title});
    } else {
        await joplin.data.post(['notes'], null, {parent_id: destinationNotebookId, body, title});
    }
}

export async function createResources(sn: SupernoteX, tmpFolder: string, noteFile: string) {
    const images = await toImage(sn)
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
