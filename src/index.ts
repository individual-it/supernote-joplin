import joplin from 'api';
import {SettingItemSubType, SettingItemType} from "../api/types";


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

joplin.plugins.register({

	onStart: async function() {
		await registerSettings();
		const supernoteNotesDirectory = await joplin.settings.value('supernote-notes-directory');
		// eslint-disable-next-line no-console
		console.info('Supernote plugin started!');
		console.info('Notes are stored in: ' + supernoteNotesDirectory);
	},
});
