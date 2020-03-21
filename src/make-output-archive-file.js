
import * as R from "ramda"
import { Buffer } from "buffer"
import mkdirp from "mkdirp-promise";
import vfs from "vinyl-fs"
// import glob from "glob"
// import tar from "gulp-tar"
import { zip } from "gulp-vinyl-zip"
import streamToPromise from "stream-to-promise"
import { getImageCompositesBy, getImageBufferResized, getImageBufferFromDataUrl } from "./components/CanvasComposites"
import { templateStringDoubleBraces } from "./utils/template-string-braces"
import path from "path"
import fs from "fs"
import rmfr from "rmfr"
import through2 from "through2";
// import getImageSize from "./utils/get-image-size";
import pngMetaData from "png-metadata";

export default async function (options) {
  const {
    currentImageDataUrlReadOnly,
    pathParams,
    configCroppers,
    configOutput,
    positionSourceImage,
    mappingCurrentCropperPositions,
    isUseSymlink = false,
  } = options;

  const {
    file_name
  } = pathParams;

  const outputName = options.outputName || file_name;

  await rmfr("./*", { glob: true });

  const workDir = `./${outputName}/data/`;

  await mkdirp(workDir);

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
    `./${workDir}/${file_name}.croppers.config.json`,
    Buffer.from(JSON.stringify({
      imagePosition: positionSourceImage,
      croppers: configCroppersModified,
      pathParams
    }, null, 2))
  );

  fs.writeFileSync(
    `./${workDir}/${file_name}.png`,
    await getImageBufferFromDataUrl(currentImageDataUrlReadOnly)
  );

  await mkdirp(path.join(workDir, `${file_name}_src`));

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
      sizeCropper: sourceCropRef.size,
      sourceImageSrc: currentImageDataUrlReadOnly,
      cropperMaskSrc: sourceCropRef.maskIsEnable ? sourceCropRef.maskUrl : null,
    });
    const fileName = `${file_name}_${sourceKey}.png`
    const fileNameFull = path.join(workDir, `${file_name}_src`, fileName);
    mappingSourceKeyToSourcePath[sourceKey] = fileNameFull;
    fs.writeFileSync(
      fileNameFull, 
      await getImageBufferFromDataUrl(imageDataUrl)
    );

    if (Array.isArray(sourceCropRef.copy) && !R.isEmpty(sourceCropRef.copy)) {
      for (const toCopy of sourceCropRef.copy) {
        const { key: keyToCopy, size: sizeToCopy } = toCopy;
        const fileNameFullToCopy = `${workDir}/${file_name}_src/${file_name}_${keyToCopy}.png`;
        mappingSourceKeyToSourcePath[keyToCopy] = fileNameFullToCopy;
        fs.writeFileSync(
          fileNameFullToCopy,
          await getImageBufferResized(imageDataUrl, ...sizeToCopy)
        );
      }
    }
  }

  for (const destination of configOutput) {
    const [key, destPathTemplate, destOptions = {}] = destination;
    const sourcePath = mappingSourceKeyToSourcePath[key];
    if (!sourcePath) {
      console.warn('destination not found:', key, destPathTemplate);
      continue;
    }
    const destPath = path.join(
      workDir,
      templateStringDoubleBraces(destPathTemplate, pathParams)
    );
    await mkdirp(path.dirname(destPath));
    // console.log('sourcePath, destPath', sourcePath, destPath)
    // fs.symlinkSync(sourcePath, destPath);
    if (destOptions.pngMeta) {
      const srcBuffer = fs.readFileSync(sourcePath);
      const metaChunks = pngMetaData.splitChunk(srcBuffer.toString('binary'));
      let indexOfIHDR = null;
      let metaChunksFiltered = metaChunks.filter((item, index) => {
        if (item.type && R.isNil(indexOfIHDR)) {
          indexOfIHDR = index;
        }
        return item.type === 'IHDR' || item.type === 'IDAT' || item.type === 'IEND'
      });
      const newChunks = destOptions.pngMeta.map(({ type, data }) => {
        return pngMetaData.createChunk(type, data)
      });
      metaChunksFiltered = R.insertAll(1, newChunks, metaChunksFiltered);
      // console.info('patched png meta', destPath, metaChunksFiltered);
      var destBuffer = pngMetaData.joinChunk(metaChunksFiltered);
      fs.writeFileSync(destPath, destBuffer, 'binary');
    } else {
      fs.symlinkSync(sourcePath, destPath);
    }
  }

  const outputFileName = `${outputName || file_name}.zip`;

  const write = vfs.src([
    `${workDir}/**/*`,
  ], {
    base: workDir,
    ...isUseSymlink && {
      resolveSymlinks: false // we want preserve symlink here
    }
  })
    .pipe(through2.obj((file, enc, next) => {
      if (file.isSymbolic()) {
        console.info('resolve file._symlink', file._symlink);
        file._symlink = path.relative(path.dirname(file.path), file._symlink);
      }
      next(null, file);
    }))
    .pipe(zip(outputFileName))
    .pipe(vfs.dest(`./${outputName}`));

  await streamToPromise(write);

  const buf = fs.readFileSync(`./${outputName}/${outputFileName}`);

  const blob = new Blob([buf.buffer], {type: "application/octet-stream"});

  return [blob, outputFileName];
}
