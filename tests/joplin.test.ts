// joplin.test.ts

import {expect, describe, it, vi, beforeEach, afterEach} from "vitest";
import {createJoplinNotebookStructure} from "../src/joplin";
import joplin from "../api";

beforeEach(async () => {
    vi.restoreAllMocks()
})

afterEach(async () => {
    vi.resetAllMocks()
})

describe('createJoplinNotebookStructure', () => {
    vi.mock('../api', (importOriginal) => {
        return {
            default: {
                data: {
                    get() {
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
                    },
                    post: vi.fn().mockImplementation((path, query, body) => {
                            if (body.parent_id === "0") {
                                return {id: "100"}
                            }
                            if (body.parent_id === "100") {
                                return {id: "1000"}
                            }
                            return {id: "newly-created-notebook-id"}
                        }
                    )
                }
            },
        }
    })
    it('creates the structure of a note that is multiple levels down the chain', async () => {
        const noteFile = 'subfolder/second level/third-level/file.note';
        const destinationNotebookId = '0';

        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);

        expect(result).toBe("newly-created-notebook-id");
        expect(joplin.data.post).toHaveBeenCalledTimes(3)
        expect(joplin.data.post).toHaveBeenNthCalledWith(1, ["folders"], null, {parent_id: "0", title: "subfolder"})
        expect(joplin.data.post).toHaveBeenNthCalledWith(2, ["folders"], null, {parent_id: "100", title: "second level"})
        expect(joplin.data.post).toHaveBeenNthCalledWith(3, ["folders"], null, {parent_id: "1000", title: "third-level"})
    });

    it('does not create any new folders for a note of the root level', async () => {
        const noteFile = 'file.note';
        const destinationNotebookId = '0';
        const result = await createJoplinNotebookStructure(noteFile, destinationNotebookId);
        expect(result).toBe(destinationNotebookId);
        expect(joplin.data.post).not.toHaveBeenCalled();
    });
});
