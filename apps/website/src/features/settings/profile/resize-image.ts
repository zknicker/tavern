const maxDimension = 128;

// Downscale a chosen image to a small square-ish data URL so it stays light in
// localStorage. Returns a PNG data URL cropped to a centered square.
export async function readAvatarImage(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('Choose an image file.');
    }

    const source = await loadImage(file);
    const size = Math.min(source.naturalWidth, source.naturalHeight);

    if (size === 0) {
        throw new Error('That image could not be read.');
    }

    const canvas = document.createElement('canvas');
    const target = Math.min(maxDimension, size);
    canvas.width = target;
    canvas.height = target;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('That image could not be processed.');
    }

    const offsetX = (source.naturalWidth - size) / 2;
    const offsetY = (source.naturalHeight - size) / 2;
    context.drawImage(source, offsetX, offsetY, size, size, 0, 0, target, target);

    return canvas.toDataURL('image/png');
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That image could not be read.'));
        };
        image.src = url;
    });
}
