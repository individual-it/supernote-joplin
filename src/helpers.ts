import fs from 'fs';

export function readFileToUint8Array(filePath: string): Promise<Uint8Array> {
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
