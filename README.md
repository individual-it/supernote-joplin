# Supernote Sync Joplin Plugin

This is a [Joplin plugin](https://joplinapp.org) to sync notes from a [supernote device](https://supernote.com/).

⚠️ This is still in heavy development. Try it if you are brave and report any issues.

## Features
- One-way-Sync of Supernote notes into Joplin. 
- The Supernote notes will be converted to images and attached to the Joplin notes. Recognized text will be added as text.
- Folder structure is preserved as a Joplin notebook structure.
- The filename of the Supernote file will become the title of the Joplin note.
- ⚠️ If there is an existing note in the Joplin structure that matches the file name of the Supernote file, it will be overwritten.
- Resources associated only with the note to be overwritten will be deleted.
- Sync happens periodically and on Joplin start.
- Only new and changed files are re-synced.
- Currently, there is NO way to sync back from Joplin to Supernote, nor to edit the notes in Joplin. Whatever change you do in Joplin to the notes, it will be overwritten in the next sync.

## Build
1. clone and build https://github.com/individual-it/supernote-typescript (I'm using the fork till a new release of https://github.com/philips/supernote-typescript is done)
2. make sure the line `"supernote-typescript": "file:../supernote-typescript",` in `package.json` points to the correct supernote-typescript/ folder
3. `npm install`
4. the compiled plugin should be in `publish/net.individual-it.Supernote.jpl`

## Install
1. Backup your data
2. Check your backup
3. Make sure your backup contains all data and is restorable
4. Transfer the supernote .note files to the device you are running Joplin on (e.g. your PC) 
   - ⚠️ this script is only tested so far with Linux and Joplin 3.4.12
   - to transfer the files, use [WebDAV](https://supernote.com/blogs/supernote-blog/private-cloud-for-data-sovereignty-serverlink-for-remote-files-control-via-webdav), sideloaded [syncthing](https://f-droid.org/en/packages/com.github.catfriend1.syncthingfork/), or a simple copy
5. Open the "Plugins" section in the Joplin options
6. Install:
   - Automatic:
      1. Search for "supernote sync"
      2. Click "Install"
   - Manual:
      1. [download the last `net.individual-it.Supernote.jpl` from the releases](https://github.com/individual-it/supernote-joplin/releases), or [build](#build) it.
      2. Press the Plugin tools "gear" button and select "Install from file" then select the .jpl file.
7. Restart Joplin

## Configure
1. On the first start you will get an error message saying that the Joplin notebook for synchronisation could not be found.
2. Right-Click on the Notebook in Joplin that you want to sync your Supernote notes to and copy the external link of it.
3. Open the Joplin options
4. Navigate to the "Supernote Sync" section
5. Paste the external link (something like `joplin://x-callback-url/openFolder?id=d3981995736a4e29a16dbb9f51a659f7`) into the `Joplin Notebook` section
6. Select the path where your Supernote notes are stored.
7. Optionally, set the sync interval. The sync will happen at the start of Joplin and every x seconds. Only changed files will be synced. Files that have been already synced and not updated will be ignored.
8. Click "OK".
9. Restart Joplin (this is a bug, see https://github.com/individual-it/supernote-joplin/issues/12)
10. Wait and pray

