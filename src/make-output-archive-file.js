
import * as R from "ramda"
import { Buffer } from "buffer"
import mkdirp from "mkdirp-promise";
import vfs from "vinyl-fs"
// import glob from "glob"
import tar from "gulp-tar"
import streamToPromise from "stream-to-promise"
import { virtualFileFromDataUrl } from "./components/SelectFile"
import { getImageCompositesBy, getImageResized } from "./components/CanvasComposites"
import { templateStringDoubleBraces } from "./utils/template-string-braces"
import path from "path"
import fs from "fs"
import rmfr from "rmfr"
import through2 from "through2";
import getImageSize from "./utils/get-image-size";

async function getImageBuffer(src, width, height) {
  const dataUrl = await getImageResized(src, width, height);
  const file = virtualFileFromDataUrl(dataUrl, 'image.png');
  return Buffer.from(await file.readAsArrayBuffer());
}

export default async function (options) {
  const {
    currentImageDataUrlReadOnly,
    pathParams,
    configCroppers,
    configOutput,
    positionSourceImage,
    mappingCurrentCropperPositions,
    isUseSymlink = false
  } = options;

  const {
    file_name
  } = pathParams;

  await rmfr("./*", { glob: true });

  await mkdirp("data");

  // const sourceKeys = Object.keys(mappingCurrentCropperPositions);

  const mappingSourceKeyToSourcePath = {};

  const configCroppersModified = configCroppers.map(([sourceKey, sourceCropRefDefault]) => {
    const sourceCropRefPatch = mappingCurrentCropperPositions[sourceKey];
    return [sourceKey, {
      ...sourceCropRefDefault,
      ...sourceCropRefPatch,
      ...!sourceCropRefPatch.maskIsEnable && {
        maskUrl: sourceCropRefDefault.maskUrl || null
      }
    }]
  });

  fs.writeFileSync(
    `./data/${file_name}.croppers.config.json`,
    Buffer.from(JSON.stringify({
      imagePosition: positionSourceImage,
      croppers: configCroppersModified
    }, null, 2))
  );

  fs.writeFileSync(
    `./data/${file_name}.png`,
    await getImageBuffer(
      currentImageDataUrlReadOnly,
      ...await getImageSize(currentImageDataUrlReadOnly)
    )
  );

  await mkdirp(path.join("data", `${file_name}_src`));

  for (const sourceCropPair of configCroppersModified) {
    const [sourceKey, sourceCropRef] = sourceCropPair;
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
      cropperMaskSrc: sourceCropRef.maskIsEnable ? sourceCropRef.maskUrl : null,
    });
    const fileName = `${file_name}_${sourceKey}.png`
    const fileNameFull = path.join("data", `${file_name}_src`, fileName);
    fs.writeFileSync(
      fileNameFull, 
      await getImageBuffer(imageDataUrl, ...sourceCropRef.size)
    );

    if (sourceCropRef.copy && Array.isArray(sourceCropRef.copy) && !R.isEmpty(sourceCropRef.copy)) {
      const [toCopy] = sourceCropRef.copy;
      const { key: keyToCopy, size: sizeToCopy } = toCopy;
      const fileNameFullToCopy = `./data/${file_name}_src/${file_name}_${keyToCopy}.png`;
      mappingSourceKeyToSourcePath[keyToCopy] = fileNameFullToCopy;
      fs.writeFileSync(
        fileNameFullToCopy,
        await getImageBuffer(imageDataUrl, ...sizeToCopy)
      );
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

  const write = vfs.src([
    "./data/**/*",
  ], {
    base: "./data",
    ...isUseSymlink && {
      resolveSymlinks: false // we want preserve symlink here
    }
  })
    .pipe(through2.obj((file, enc, next) => {
      if (file.isSymbolic()) {
        file._symlink = path.relative(path.dirname(file.path), file._symlink);
      }
      next(null, file);
    }))
    .pipe(tar(`${file_name}.tar`))
    .pipe(vfs.dest("./dist"));

  await streamToPromise(write);

  const buf = fs.readFileSync(`./dist/${file_name}.tar`);

  const blob = new Blob([buf.buffer], {type: "application/octet-stream"});

  return [blob, `${file_name}.tar`]
}
