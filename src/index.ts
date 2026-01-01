import joplin from 'api';
import fs = require('fs');
import {SettingItemSubType, SettingItemType} from "../api/types";
import * as imagejs from "image-js"
import {SupernoteX, toImage} from "supernote-typescript";
import path = require('path');

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

	onStart: async function() {
		await registerSettings();
		const supernoteNotesDirectory = await joplin.settings.value('supernote-notes-directory');
		// eslint-disable-next-line no-console
		console.info('Supernote plugin started!');
		console.info('Notes are stored in: ' + supernoteNotesDirectory);
		if (!fs.existsSync(supernoteNotesDirectory)) {
			throw new Error('The supernote directory does not exist!');
		}

		const files = await fs.promises.readdir(supernoteNotesDirectory, { recursive: true });
		const noteFiles = files.filter(file => file.endsWith('.note'));

		console.info(`found ${noteFiles.length} files`);
		console.info(noteFiles);

		for (const noteFile of noteFiles) {
			const fullPath = path.join(supernoteNotesDirectory, noteFile);
			console.info(`Reading note: ${fullPath}`);
			let sn = new SupernoteX(await readFileToUint8Array(fullPath));
			console.info(`In ${noteFile} there are ${sn.pages.length} pages!`);

			let images = await toImage(sn)
			console.info(images.length);
			const fullOutputPath = path.join(supernoteNotesDirectory, 'output', `${noteFile}-0.png`);

			for await (const [index, image] of images.entries()) {
				const fullOutputPath = path.join(supernoteNotesDirectory, 'output', `${noteFile}-${index}.png`)

				const outputDirName = path.dirname(fullOutputPath);
				if (!fs.existsSync(outputDirName)) {
					fs.mkdirSync(outputDirName, { recursive: true });
				}

				try {
					imagejs.writeSync(path.join(fullOutputPath,) , image)
				} catch (e) {
					console.error(e)
				}

			}
		}
	},
});
