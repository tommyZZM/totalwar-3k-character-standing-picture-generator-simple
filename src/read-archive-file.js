import path from "path"
import fs from "fs"
import rmfr from "rmfr"
import through2 from "through2";
import mkdirp from "mkdirp-promise";
import vfs from "vinyl-fs"
import { src as zipSrc } from "gulp-vinyl-zip"
import streamToPromise from "stream-to-promise"
import { virtualFileFromUint8Array } from "./components/SelectFile"

export default async function readArchiveFileTakeMajorConfig(virtualFile) {
  await rmfr("./*", { glob: true });

  const targetFileName = path.basename(virtualFile.path);

  const targetFileNameWithoutExtension = R.dropLast(1, targetFileName.split('.')).join('.')

  fs.writeFileSync(
    targetFileName,
    Buffer.from(await virtualFile.readAsArrayBuffer())
  );

  await mkdirp('./out');

  const extract = zipSrc(targetFileName)
    .pipe(through2.obj((file, enc, next) => {
      if (file.stat.isDirectory()) {
        return next();
      }
      return next(null, file);
    }))
    .pipe(vfs.dest(`./out`));

  await streamToPromise(extract);

  const rawConfigJson = fs.readFileSync(`./out/${targetFileNameWithoutExtension}.croppers.config.json`);

  const rawSourceImage = fs.readFileSync(`./out/${targetFileNameWithoutExtension}.png`);

  const stringConfigJson = new TextDecoder("utf-8").decode(rawConfigJson);

  const configJson = JSON.parse(stringConfigJson);

  return {
    targetFileNameWithoutExtension,
    vfileSourceImage: virtualFileFromUint8Array(
      rawSourceImage, `${targetFileNameWithoutExtension}.png`
    ),
    configWithCroppers: configJson
  }
}
