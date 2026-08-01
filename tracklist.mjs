import path from "node:path";
import fs from "node:fs";

const input = process.argv[2];
const csvArray = [["FILENAME", "LIBRARY", "SUPPLIER", "URL"]];

if (!input) {
  console.error("Please provide the path to a sonniss gdc folder");
  process.exit(1);
}

const absolutePath = path.resolve(input);
const tracklistPath = path.join(absolutePath, "Tracklist.csv");

if (fs.existsSync(tracklistPath)) {
  console.error("The provided path already contains Tracklist.csv");
  process.exit(1);
}

findWavFilesAndGenerateMetadata();
convertCsvArrayToFile();

function findWavFilesAndGenerateMetadata() {
    const folders = fs.readdirSync(absolutePath, { withFileTypes: true });

    for (const folder of folders) {
        if (!folder.isDirectory()) continue;
        iterateOverWavFilesAndGenerateMetadata(folder);
    }
}

function iterateOverWavFilesAndGenerateMetadata(folder) {
    const folderPath = path.join(absolutePath, folder.name);
    const files = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const file of files) {
        if (!file.isFile()) continue;
        if (path.extname(file.name).toLowerCase() !== ".wav") continue;

        csvArray.push(generateMetadata(file, folder));
    }
}

function generateMetadata(file, folder) {
    const [library, supplier] = folder.name.split("-").map(item => item.trim());
    return [file.name, library, supplier, "https://sonniss.com/"]
}

function convertCsvArrayToFile() {
    const output = csvArray.map(item => {
        return item.map(value => `"${value}"`);
    })

    fs.writeFileSync(tracklistPath, output.join("\n"), "utf8");
}