import joplin from 'api';
import fs = require('fs');
import {SettingItemSubType, SettingItemType} from "../api/types";
import {SupernoteX} from "supernote-typescript";
import path = require('path');
import url = require('url');
import os = require('os');
import querystring = require('querystring');
import {createJoplinNotebookStructure, createResources, writeNote} from "./joplin";

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

function readFileToUint8Array(filePath: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(new Uint8Array(data.buffer));
            }
        });
    });
}

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

        const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'joplin-super-notebook'));
        for (const noteFile of noteFiles) {
            const destinationNotebookId = await createJoplinNotebookStructure(noteFile, destinationNotebook.id);
            const sn = new SupernoteX(await readFileToUint8Array(path.join(supernoteNotesDirectory, noteFile)));
            let noteContent = "";
            for (const page of sn.pages) {
                if (page.paragraphs.trim().length > 0) {
                    noteContent += page.paragraphs + "\n\n";
                }
            }
            for (const resource of await createResources(sn, tmpFolder, noteFile)) {
                noteContent += `![${resource.title}](:/${resource.id})\n`;
            }
            await writeNote(destinationNotebookId, noteFile, noteContent)
        }
        fs.rmdirSync(tmpFolder);
    },
});
