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
import fs from 'fs';
import path from 'path';

import os from 'os';

let syncInterval: NodeJS.Timeout;

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

    await joplin.settings.registerSettings({
        'sync-interval-seconds': {
            value: 600,
            type: SettingItemType.Int,
            section: sectionName,
            public: true,
            label: 'Sync Interval in seconds',
            description: 'How frequent to sync the .note files to Joplin.',
        },
    });
};

const run = async () => {
    const supernoteNotesDirectory = await joplin.settings.value('supernote-notes-directory');
    const destinationNotebookExternalLink = await joplin.settings.value('destination-notebook');
    const destinationRootNotebookId = await getDestinationRootNotebook(destinationNotebookExternalLink);


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
        await showMessage(ToastType.Info, toastMessage);
        let sn: SupernoteX;
        try {
            sn = new SupernoteX(await readFileToUint8Array(fullPathOfNoteFile));
        } catch (e) {
            const errorMessage = `could not parse '${fullPathOfNoteFile}'`
            await showMessage(ToastType.Error, errorMessage)
            console.error(errorMessage)
            console.error(e)
            continue
        }

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
};


joplin.plugins.register({
    onStart: async function () {
        await registerSettings();
        let interval = await joplin.settings.value('sync-interval-seconds') * 1000;
        await run();
        syncInterval = setInterval(run, interval);
        await joplin.settings.onChange(async () => {
            clearInterval(syncInterval);
            interval = await joplin.settings.value('sync-interval-seconds') * 1000;
            syncInterval = setInterval(run, interval);
        });
    }
});
