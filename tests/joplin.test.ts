// joplin.test.ts
import fs = require('fs');
import {expect, describe, it, vi, beforeEach, afterEach} from "vitest";
import {createJoplinNotebookStructure, createResources, findMatchingNote, writeNote} from "../src/joplin";
import joplin from "../api";
import {SupernoteX} from "../../supernote-typescript/src";
import {readFileToUint8Array} from "../src/helpers";

vi.mock('../api', (importOriginal) => {
    return {
        default: {
            data: {
                get: vi.fn(),
                post: vi.fn(),
                put: vi.fn()
            }
        },
    }
})
beforeEach(async () => {
    vi.restoreAllMocks()
})

afterEach(async () => {
    vi.resetAllMocks()
})

describe('createJoplinNotebookStructure', () => {

    beforeEach(async () => {
        vi.mocked(joplin.data.get).mockImplementationOnce((): any => {
            return {
                "items": [
                    {
                        "id": "2",
                        "parent_id": "",
                        "title": "test1",
                        "deleted_time": 0
                    },
                    {
                        "id": "0",
                        "parent_id": "",
                        "title": "supernote",
                        "deleted_time": 0
                    },
                    {
                        "id": "1",
                        "parent_id": "0",
                        "title": "an other folder",
                        "deleted_time": 0
                    }
                ],
                "has_more": true
            }
        })
        vi.mocked(joplin.data.get).mockImplementationOnce((): any => {
            return {
                "items": [
                    {
                        "id": "2-1",
                        "parent_id": "0",
                        "title": "subfolder-second-page",
                        "deleted_time": 0
                    },
                ],
                "has_more": true
            }
        })
        vi.mocked(joplin.data.get).mockImplementationOnce((): any => {
            return {
                "items": [
                    {
                        "id": "3-0",
                        "parent_id": "2-1",
                        "title": "subfolder-third-page",
                        "deleted_time": 0
                    },
                ],
                "has_more": false
            }
        })
        vi.mocked(joplin.data.post).mockImplementation((path, query, body): any => {
                if (body.parent_id === "0") {
                    return {id: "100"}
                }
                if (body.parent_id === "100") {
                    return {id: "1000"}
                }
                return {id: "newly-created-notebook-id"}
            }
        )
    })
    it('creates the structure of a note that is multiple levels down the chain', async () => {
        const noteFile = 'subfolder/second level/third-level/file.note';
        const destinationNotebookId = '0';

        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);

        expect(result).toBe("newly-created-notebook-id");
        expect(joplin.data.post).toHaveBeenCalledTimes(3)
        expect(joplin.data.post).toHaveBeenNthCalledWith(1, ["folders"], null, {parent_id: "0", title: "subfolder"})
        expect(joplin.data.post).toHaveBeenNthCalledWith(2, ["folders"], null, {
            parent_id: "100",
            title: "second level"
        })
        expect(joplin.data.post).toHaveBeenNthCalledWith(3, ["folders"], null, {
            parent_id: "1000",
            title: "third-level"
        })
    });

    it('does not create new folders if a subfolder exists', async () => {
        const noteFile = 'an other folder/file.note';
        const destinationNotebookId = '0';
        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);
        expect(result).toBe('1');
        expect(joplin.data.post).not.toHaveBeenCalled();
    });

    it('does not create new folders if a subfolder exists (pagination)', async () => {
        const noteFile = 'subfolder-second-page/subfolder-third-page/file.note';
        const destinationNotebookId = '0';
        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);
        expect(result).toBe('3-0');
        expect(joplin.data.post).not.toHaveBeenCalled();
    });

    it('does not create any new folders for a note of the root level', async () => {
        const noteFile = 'file.note';
        const destinationNotebookId = '0';
        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);
        expect(result).toBe(destinationNotebookId);
        expect(joplin.data.post).not.toHaveBeenCalled();
    });
});

describe("findMatchingNote", () => {

    beforeEach(async () => {
        vi.mocked(joplin.data.get).mockImplementationOnce((path): any => {
            return {
                "items": [
                    {
                        "id": "2",
                        "title": "test1",
                    },
                    {
                        "id": "3",
                        "title": "file",
                    },
                    {
                        "id": "1",
                        "title": "an other note",
                    }
                ],
                has_more: true
            }
        })
        vi.mocked(joplin.data.get).mockImplementationOnce((path): any => {
            return {
                "items": [
                    {
                        "id": "2-2",
                        "title": "test1 on page2",
                    },
                    {
                        "id": "2-1",
                        "title": "an other note on page 2",
                    }
                ],
                has_more: true
            }
        })
        vi.mocked(joplin.data.get).mockImplementationOnce((path): any => {
            return {
                "items": [
                    {
                        "id": "3-2",
                        "title": "test1 on page 3",
                    },
                    {
                        "id": "3-1",
                        "title": "an other note on page 3",
                    }
                ],
                has_more: false
            }
        })
        vi.mocked(joplin.data.get).mockImplementationOnce((path): any => {
            return {
                id: path[1]
            }
        })
    })
    it('finds a note matching the file in the given notebook', async () => {
        const noteFile = 'subfolder/an other folder/file.note';
        const destinationNotebookId = '123';
        const result = await findMatchingNote(destinationNotebookId, noteFile);
        expect(result.id).toBe('3');
        expect(joplin.data.get).toHaveBeenNthCalledWith(1, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(2, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(3, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(4, ['notes', '3'], {fields: ['id', 'title', 'updated_time']});
    })
    it('finds a note matching the file in the given notebook (pagination)', async () => {
        const noteFile = 'subfolder/an other folder/test1 on page 3.note';
        const destinationNotebookId = '123';
        const result = await findMatchingNote(destinationNotebookId, noteFile);
        expect(result.id).toBe('3-2');
        expect(joplin.data.get).toHaveBeenNthCalledWith(1, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(2, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(3, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(4, ['notes', '3-2'], {fields: ['id', 'title', 'updated_time']});
    })
    it('returns null if there is no matching note', async () => {
        const noteFile = 'subfolder/an other folder/not-existing-note.note';
        const destinationNotebookId = '123';
        const result = await findMatchingNote(destinationNotebookId, noteFile);
        expect(result).toBeNull();
        expect(joplin.data.get).toHaveBeenNthCalledWith(1, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenCalledOnce();
    })
})

describe("writeNote", () => {
    it.for([[false],[""],[null],[undefined]]) ('creates a new note when no matching note is given', async ([matchingNote]) => {
        await writeNote('123', matchingNote, 'subfolder/my note.note','content')
        expect(joplin.data.post).toHaveBeenCalledWith(['notes'], null, {parent_id: '123', body: 'content', title: 'my note'});
        expect(joplin.data.post).toHaveBeenCalledOnce();
        expect(joplin.data.put).not.toHaveBeenCalled();
    })
    it ('overwrites the matching note', async () => {
        await writeNote('123', {id: 'matchingNote'}, 'subfolder/my note.note','content')
        expect(joplin.data.put).toHaveBeenCalledWith(['notes', 'matchingNote'], null , {body: 'content', title: 'my note'});
        expect(joplin.data.put).toHaveBeenCalledOnce();
        expect(joplin.data.post).not.toHaveBeenCalled();
    })
})

describe('createResources', () => {
    const tmpFolder = '.tmp';
    beforeEach(async () => {
        vi.mocked(joplin.data.post).mockImplementationOnce((path, query, body): any => {
                return {id: "newly-created-resource-id", title: body.title};
            }
        )
        vi.mocked(joplin.data.post).mockImplementationOnce((path, query, body): any => {
                return {id: "second-created-resource-id", title: body.title};
            }
        )
        vi.mocked(joplin.data.post).mockImplementationOnce((path, query, body): any => {
                return {id: "third-created-resource-id", title: body.title};
            }
        )
    })
    afterEach(async () => {
        fs.rmSync(tmpFolder, {recursive: true, force: true});
    })
    it('creates a new resource for a single-page note', async () => {
        const sn = new SupernoteX(await readFileToUint8Array('./tests/fixtures/Single page.note'));
        const createdResources = await createResources(sn, './tmp', 'Single page.note');
        expect(createdResources).toHaveLength(1);
        expect(createdResources[0].id).toBe("newly-created-resource-id")
        expect(createdResources[0].title).toBe("Single page.note-0.png")
        expect(joplin.data.post).toHaveBeenCalledWith(
            ['resources'], null, {title: 'Single page.note-0.png'}, [{path:'tmp/Single page.note-0.png'}]
        );
        expect(joplin.data.post).toHaveBeenCalledOnce();
    })
    it('creates a new resource for every page of a multipage note', async () => {
        const sn = new SupernoteX(await readFileToUint8Array('./tests/fixtures/multiple pages.note'));
        const createdResources = await createResources(sn, './tmp', 'multiple pages.note');
        expect(createdResources).toHaveLength(3);
        expect(createdResources[0].id).toBe("newly-created-resource-id")
        expect(createdResources[0].title).toBe("multiple pages.note-0.png")
        expect(createdResources[1].id).toBe("second-created-resource-id")
        expect(createdResources[1].title).toBe("multiple pages.note-1.png")
        expect(createdResources[2].id).toBe("third-created-resource-id")
        expect(createdResources[2].title).toBe("multiple pages.note-2.png")
        expect(joplin.data.post).toHaveBeenNthCalledWith(1,
            ['resources'], null, {title: 'multiple pages.note-0.png'}, [{path:'tmp/multiple pages.note-0.png'}]
        );
        expect(joplin.data.post).toHaveBeenNthCalledWith(2,
            ['resources'], null, {title: 'multiple pages.note-1.png'}, [{path:'tmp/multiple pages.note-1.png'}]
        );
        expect(joplin.data.post).toHaveBeenNthCalledWith(3,
            ['resources'], null, {title: 'multiple pages.note-2.png'}, [{path:'tmp/multiple pages.note-2.png'}]
        );
        expect(joplin.data.post).toHaveBeenCalledTimes(3);
    })
})
