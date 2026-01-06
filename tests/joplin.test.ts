// joplin.test.ts

import {expect, describe, it, vi, beforeEach, afterEach} from "vitest";
import {createJoplinNotebookStructure, findMatchingNote, writeNote} from "../src/joplin";
import joplin from "../api";

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
        vi.mocked(joplin.data.get).mockImplementation((): any => {
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
        vi.mocked(joplin.data.get).mockImplementation((path): any => {
            if (path[0] == "folders") {
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
                }
            }
            if (path[0] == "notes") {
                return {
                    id: "3"
                }
            }
        })
    })
    it('finds a note matching the file in the given notebook', async () => {
        const noteFile = 'subfolder/an other folder/file.note';
        const destinationNotebookId = '123';
        const result = await findMatchingNote(destinationNotebookId, noteFile);
        expect(result.id).toBe('3');
        expect(joplin.data.get).toHaveBeenNthCalledWith(1, ['folders', '123', 'notes']);
        expect(joplin.data.get).toHaveBeenNthCalledWith(2, ['notes', '3'], {fields: ['id', 'title', 'updated_time']});
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
