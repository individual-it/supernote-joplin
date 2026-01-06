import joplin from 'api';
import {SettingItemSubType, SettingItemType} from "../api/types";
import {SupernoteX} from "supernote-typescript";
import {createJoplinNotebookStructure, createResources, findMatchingNote, writeNote} from "./joplin";
import {readFileToUint8Array} from "./helpers";
import fs = require('fs');
import path = require('path');
import url = require('url');
import os = require('os');
import querystring = require('querystring');

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
            label: 'Directory to the .note files of Supernote',
        },
    });

    await joplin.settings.registerSettings({
        'destination-notebook': {
            value: '',
            type: SettingItemType.String,
            section: sectionName,
            public: true,
            label: 'External link of the Joplin Notebook, in which you want to import the .note files',
        },
    });
};

joplin.plugins.register({

    onStart: async function () {
        await registerSettings();
        const supernoteNotesDirectory = await joplin.settings.value('supernote-notes-directory');
        const destinationNotebookExternalLink = await joplin.settings.value('destination-notebook');
        const destinationNotebookURL = url.parse(destinationNotebookExternalLink)
        const destinationNotebook = querystring.parse(destinationNotebookURL.query);
        if (!destinationNotebook.id || Array.isArray(destinationNotebook.id)) {
            throw new Error("could not find id in the given link of the notebook");
        }


        // eslint-disable-next-line no-console
        console.info('Supernote plugin started!');
        console.info('Notes are stored in: ' + supernoteNotesDirectory);
        if (!fs.existsSync(supernoteNotesDirectory)) {
            throw new Error('The supernote directory does not exist!');
        }

        const files = await fs.promises.readdir(supernoteNotesDirectory, {recursive: true});
        const noteFiles = files.filter(file => file.endsWith('.note'));

        console.info(`found ${noteFiles.length} files`);
        console.info(noteFiles);

        const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'joplin-supernote-sync'));
        for (const noteFile of noteFiles) {
            const destinationNotebookId = await createJoplinNotebookStructure(noteFile, destinationNotebook.id);
            const fullPathOfNoteFile = path.join(supernoteNotesDirectory, noteFile)
            const statsNoteFile = fs.statSync(fullPathOfNoteFile);
            const matchingNote = await findMatchingNote(destinationNotebookId, noteFile);

            if (matchingNote && statsNoteFile.mtime.getTime() < matchingNote.updated_time) {
                console.info(`skipping ${noteFile} as file mtime is ${statsNoteFile.mtime.getTime()} and note updated time: ${matchingNote.updated_time} `);
                continue
            }
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
