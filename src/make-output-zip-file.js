
import * as R from "ramda"
import { Buffer } from "buffer"
import mkdirp from "mkdirp-promise";
import vfs from "vinyl-fs"
// import glob from "glob"
import { zip } from "gulp-vinyl-zip"
import streamToPromise from "stream-to-promise"
import { virtualFileFromDataUrl } from "./components/SelectFile"
import { getImageCompositesBy, getImageResized } from "./components/CanvasComposites"
import { templateStringDoubleBraces } from "./utils/template-string-braces"
import path from "path"
import fs from "fs"
import through2 from "through2";

export default async function (options) {
  const {
    currentImageDataUrlReadOnly,
    pathParams,
    configCroppers,
    configOutput,
    positionSourceImage,
    mappingCurrentCropperPositions,
  } = options;

  const {
    file_name
  } = pathParams;

  await mkdirp("data");

  // const sourceKeys = Object.keys(mappingCurrentCropperPositions);

  const mappingSourceKeyToSourcePath = {};

  for (const sourceCropPair of configCroppers) {
    const [sourceKey, sourceCropRefDefault] = sourceCropPair;
    const sourceCropRef = {
      ...sourceCropRefDefault,
      ...mappingCurrentCropperPositions[sourceKey]
    };
    const positionCropper = R.pick(["x", "y", "width", "height"], sourceCropRef);
    const positionPercentageCropperMask = {
      xPercentage: sourceCropRef?.maskPosition.x,
      yPercentage: sourceCropRef?.maskPosition.y,
      widthPercentage: sourceCropRef?.maskPosition.width,
      heightPercentage: sourceCropRef?.maskPosition.height,
    }
    const imageDataUrl = await getImageCompositesBy({
      positionSourceImage,
      positionCropper,
      positionPercentageCropperMask,
      sourceImageSrc: currentImageDataUrlReadOnly,
      cropperMaskSrc: sourceCropRef.maskUrl,
    });
    const fileName = `${file_name}_${sourceKey}.png`
    const imageFile = virtualFileFromDataUrl(imageDataUrl, fileName);
    const fileBinary = await imageFile.readAsArrayBuffer();
    const fileNameFull = path.join("data", fileName);
    mappingSourceKeyToSourcePath[sourceKey] = fileNameFull;
    fs.writeFileSync(fileNameFull, Buffer.from(fileBinary));

    if (sourceCropRef.copy && Array.isArray(sourceCropRef.copy) && !R.isEmpty(sourceCropRef.copy)) {
      const [toCopy] = sourceCropRef.copy;
      const { key: keyToCopy, size: sizeToCopy } = toCopy;
      const imageDataUrlToCopy = await getImageResized(imageDataUrl, ...sizeToCopy);
      const fileNameFullToCopy = `./data/${file_name}_${keyToCopy}.png`;
      const imageFileToCopy = virtualFileFromDataUrl(imageDataUrlToCopy, fileName);
      mappingSourceKeyToSourcePath[sourceKey] = fileNameFullToCopy;
      fs.writeFileSync(fileNameFullToCopy, Buffer.from(await imageFileToCopy.readAsArrayBuffer()));
    }
  }

  for (const destination of configOutput) {
    const [key, destPathTemplate] = destination;
    const sourcePath = mappingSourceKeyToSourcePath[key];
    if (!sourcePath) {
      continue;
    }
    const destPath = path.join(
      "data",
      templateStringDoubleBraces(destPathTemplate, pathParams)
    );
    await mkdirp(path.dirname(destPath));
    fs.symlinkSync(sourcePath, destPath);
  }

  const write = vfs.src("./data/**/*", {
    base: "./data"
  })  
    .pipe(through2.obj((file, enc, next) => {
      next(null, file);
    }))
    .pipe(zip(`${file_name}.zip`))
    .pipe(vfs.dest("./dist"));

  await streamToPromise(write);

  const buf = fs.readFileSync(`./dist/${file_name}.zip`);

  const blob = new Blob([buf.buffer], {type: "application/octet-stream"});

  return [blob, `${file_name}.zip`]
}
