import joplin from 'api';
import {SettingItemSubType, SettingItemType, ToastType} from "../api/types";
import {SupernoteX} from "supernote-typescript";
import {
    createJoplinNotebookStructure,
    createResources,
    findMatchingNote,
    getDestinationRootNotebook,
    showMessage,
    writeNote
} from "./joplin";
import {readFileToUint8Array} from "./helpers";
import fs = require('fs');
import path = require('path');

import os = require('os');

const registerSettings = async () => {
    const sectionName = 'supernote';
    await joplin.settings.registerSection(sectionName, {
        label: 'Supernote Sync',
        description: 'Sync your notes from your Supernote device into Joplin',
        iconName: 'fas fa-pen-fancy',
    });

    await joplin.settings.registerSettings({
        'supernote-notes-directory': {
            value: '',
            type: SettingItemType.String,
            subType: SettingItemSubType.DirectoryPath,
            section: sectionName,
            public: true,
            label: 'Supernote Directory',
            description: 'Directory to the .note files of Supernote',
        },
    });

    await joplin.settings.registerSettings({
        'destination-notebook': {
            value: '',
            type: SettingItemType.String,
            section: sectionName,
            public: true,
            label: 'Joplin Notebook',
            description: 'External link of the Joplin Notebook, to which you want to sync the .note files to.',
        },
    });
};

joplin.plugins.register({

    onStart: async function () {
        await registerSettings();
        const dialogs = joplin.views.dialogs;
        const supernoteNotesDirectory = await joplin.settings.value('supernote-notes-directory');
        const destinationNotebookExternalLink = await joplin.settings.value('destination-notebook');
        const destinationRootNotebookId = await getDestinationRootNotebook(destinationNotebookExternalLink);

        // eslint-disable-next-line no-console
        console.info('Supernote plugin started!');
        console.info('Notes are stored in: ' + supernoteNotesDirectory);
        if (!fs.existsSync(supernoteNotesDirectory)) {
            const message = 'The supernote directory does not exist!'
            await showMessage(
                ToastType.Error,
                message
            );
            throw Error(message);
        }

        const files = await fs.promises.readdir(supernoteNotesDirectory, {recursive: true});
        const noteFiles = files.filter(file => file.endsWith('.note'));

        console.info(`found ${noteFiles.length} files`);
        console.info(noteFiles);

        const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'joplin-supernote-sync'));
        for (const noteFile of noteFiles) {
            const destinationNotebookId = await createJoplinNotebookStructure(noteFile, destinationRootNotebookId);
            const fullPathOfNoteFile = path.join(supernoteNotesDirectory, noteFile)
            const statsNoteFile = fs.statSync(fullPathOfNoteFile);
            const matchingNote = await findMatchingNote(destinationNotebookId, noteFile);

            if (matchingNote && statsNoteFile.mtime.getTime() < matchingNote.updated_time) {
                console.info(`skipping ${noteFile} as file mtime is ${statsNoteFile.mtime.getTime()} and note updated time: ${matchingNote.updated_time} `);
                continue
            }

            let toastMessage = `syncing file '${fullPathOfNoteFile}'`
            if (matchingNote) {
                toastMessage += ` - to note '${matchingNote.title}'`;
            }
            await showMessage(ToastType.Info, toastMessage );
            const sn = new SupernoteX(await readFileToUint8Array(fullPathOfNoteFile));
            let noteContent = "";
            for (const page of sn.pages) {
                if (page.paragraphs.trim().length > 0) {
                    noteContent += page.paragraphs + "\n\n";
                }
            }
            for (const resource of await createResources(sn, tmpFolder, noteFile)) {
                noteContent += `![${resource.title}](:/${resource.id})\n`;
            }
            await writeNote(destinationNotebookId, matchingNote, noteFile, noteContent)
        }
        try {
            fs.rmSync(tmpFolder, {recursive: true, force: true});
        } catch (e) {
            console.error(e);
        }
    },
});
