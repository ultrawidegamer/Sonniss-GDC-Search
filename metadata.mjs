import path from "node:path";
import fs from "node:fs";

const input = process.argv[2];

if (!input) {
  console.error("Please provide the path to a sonniss gdc folder");
  process.exit(1);
}

const absolutePath = path.resolve(input);
const tracklistPath = path.join(absolutePath, "Tracklist.csv");

if (!fs.existsSync(tracklistPath)) {
  console.error("Please provide the path to a sonniss gdc folder and that it contains a Tracklist.csv file");
  process.exit(1);
}

const tracklist = fs.readFileSync(tracklistPath, "utf8");
const tracks = tracklist.trim().split("\n");

const updatedTracks = tracks.map((track, index) => {
    const trackData = track
        .replace(/"([^"]*)"/g, (_, value) => `${value.replaceAll(",", "<COMMA>")}`)
        .split(',')
        .map(data => data.replaceAll("<COMMA>"  , ",").trim());

    if (index == 0) {
        return ["FILENAME","LIBRARY","SUPPLIER","URL","DOWNLOAD","TAGS"];
    } else {
        return addColumnData(trackData);
    }
})

convertToCsv(updatedTracks);

function convertToCsv(updatedTracks) {
    const output = updatedTracks.map(track => {
        return track.map(item => `"${item}"`);
    })

    fs.writeFileSync(tracklistPath.replace(".csv", "-modified.csv"), output.join("\n"), "utf8");
}

function addColumnData(track) {
    const wavPath = findFile(track[0]);

    if (wavPath === undefined) {
        console.error("ERROR: invalid path: ", track);
        return "";
    }

    track.push(wavPath.replace(absolutePath, ""));

    const tagString = getWavTags(track, wavPath)
        .join('|')
        .toLowerCase();

    track.push(tagString);

    return track;
}

function findFile(filename) {
    const folders = fs.readdirSync(absolutePath, { withFileTypes: true });

    for (const folder of folders) {
        if (!folder.isDirectory()) continue;

        const filePath = path.join(absolutePath, folder.name, filename);

        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
}

function getWavTags(track, wavPath) {
    const comment = getWavComment(wavPath);
    const cleanedComment = cleanComment(comment);
    const tags = [];
    
    tags.push(...splitString(cleanedComment, " "));
    tags.push(...getExtraTags(track))

    return [...new Set(tags)];
}

function splitString(str, char) {
    return str.split(char)
        .map(data => data.trim())
        .filter(data => data !== "")
}

function cleanComment(comment) {
    return comment
        .replace(/[\r\n]+/g, "")
        .replaceAll("-", "")
        .replaceAll(".", "")
        .replaceAll(":", "")
        .replaceAll(",", " ")
}

function getWavComment(wavPath) {
    const buffer = fs.readFileSync(wavPath);
    let offset = 12;

    while (offset + 8 <= buffer.length) {
        const id = buffer.toString("ascii", offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);

        if (id === "bext") {
            const start = offset + 8;

            // Read only the 256-byte Description field
            const description = buffer
                .slice(start, start + Math.min(256, size))
                .toString("ascii")
                .split("\0")[0]
                .trim();

            return description;
        }

        offset += 8 + size + (size & 1);
    }

    return "";
}

function getExtraTags(target) {
    return [
        ...splitString(cleanComment(target[0]), " "),
        target[1],
        target[2]
    ]
}
