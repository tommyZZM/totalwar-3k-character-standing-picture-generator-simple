import React from "react";
import { virtualFileFromDataUrl } from "./SelectFile"
import jimp from "jimp/dist"

async function getImageLoaded(src) {
  if (!src) {
    return null;
  }

  const img = document.createElement('img');

  const load = new Promise(resolve => {
    img.onload = () => {
      resolve(img)
    };
    img.setAttribute("src", src)
  });

  return load;
}

const SHARED_CANVAS_MASK = document.createElement("canvas");
const SHARED_CTX_CANVAS_MASK = SHARED_CANVAS_MASK.getContext("2d");

const SHARED_CANVAS_OUTPUT = document.createElement("canvas");
const SHARED_CTX_CANVAS_OUTPUT = SHARED_CANVAS_OUTPUT.getContext("2d");
// SHARED_CTX_CANVAS_OUTPUT.imageSmoothingEnabled = false;

export async function getImageBufferFromDataUrl(dataUrl) {
  const file = virtualFileFromDataUrl(dataUrl, 'image.png');
  return Buffer.from(await file.readAsArrayBuffer());
}

export async function getImageBufferResized(src, width, height) {
  return getImageBufferFromDataUrl(
    await getImageResized(src, width, height)
  );
}

async function _getImageResizedUsingBinary(dataUrl, width, height) {
  const buffer = await getImageBufferFromDataUrl(dataUrl);

  const imgHandle = await jimp.read(buffer);

  await imgHandle.resize(width, height, jimp.RESIZE_BICUBIC);

  return imgHandle.getBase64Async("image/png");
}

export async function getImageResized(src, width, height) {
  const sourceImg = await getImageLoaded(src);
  const ratio = 2;

  SHARED_CANVAS_OUTPUT.setAttribute("width", width * ratio);
  SHARED_CANVAS_OUTPUT.setAttribute("height", height * ratio);
  SHARED_CANVAS_OUTPUT.style.cssText = `background: transparent; width: ${width}px; height: ${height}px`;

  SHARED_CTX_CANVAS_OUTPUT.globalCompositeOperation = 'source-over';
  SHARED_CTX_CANVAS_OUTPUT.clearRect(0, 0, width * ratio, height * ratio);
  SHARED_CTX_CANVAS_OUTPUT.drawImage(
    sourceImg, 0, 0, 
    width * ratio,
    height * ratio,
  );

  return _getImageResizedUsingBinary(
    SHARED_CANVAS_OUTPUT.toDataURL(), width, height
  );
}

async function drawComposites(options) {
  const {
    sourceImageSrc,
    cropperMaskSrc,
    canvasWidth,
    canvasHeight,
    imagePositionToDraw,
    maskPositionToDraw,
    ctxMask,
    canvasMask,
    ctx,
    // ratio = 1
  } = options;

  const sourceImg = await getImageLoaded(sourceImageSrc);
  const maskImg = await getImageLoaded(cropperMaskSrc);

  if (maskImg) {
    ctxMask.clearRect(0, 0, canvasWidth, canvasHeight);
    ctxMask.strokeStyle = "none";
    ctxMask.drawImage(maskImg, ...maskPositionToDraw.map(num => parseInt(num)));

    const [x, y, w, h] = maskPositionToDraw;
    const imageDataMask = ctxMask.getImageData(
      x, y, w + 1, h + 1
    );

    // TODO: to alpha
    const imageDataMaskUnit32 = new Uint32Array(imageDataMask.data.buffer);
    var i = 0, len = imageDataMaskUnit32.length;

    while (i < len) {
      imageDataMaskUnit32[i] = imageDataMaskUnit32[i++] << 8;
      // shift blue channel into alpha (little-endian)
    }

    ctxMask.putImageData(imageDataMask, ...R.take(2, maskPositionToDraw));
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (maskImg) {
    ctx.drawImage(canvasMask, 0, 0, canvasWidth, canvasHeight);
    ctx.globalCompositeOperation = 'source-in';
  }
  const [xImage, yImage, wImage, hImage] = imagePositionToDraw;
  ctx.drawImage(sourceImg, xImage, yImage, wImage, hImage);
  ctx.globalCompositeOperation = 'source-over';
}

export async function getImageCompositesBy(options) {
  const {
    sizeCropper,
  } = options;
  const {
    canvasWidth,
    canvasHeight,
    imagePositionToDraw,
    maskPositionToDraw,
  } = CanvasComposites.getDrawCompositesOptionsFromProps({
    ...options,
    ratio: 2 // draw double
  });

  SHARED_CANVAS_MASK.setAttribute("width", canvasWidth);
  SHARED_CANVAS_MASK.setAttribute("height", canvasHeight);
  SHARED_CANVAS_MASK.style.cssText = `background: transparent; width: ${canvasWidth}px; height: ${canvasHeight}`;

  SHARED_CANVAS_OUTPUT.setAttribute("width", canvasWidth);
  SHARED_CANVAS_OUTPUT.setAttribute("height", canvasHeight);
  SHARED_CANVAS_OUTPUT.style.cssText = `background: transparent; width: ${canvasWidth}px; height: ${canvasHeight}`;

  await drawComposites({
    ...options,
    // ratio,
    canvasWidth,
    canvasHeight,
    imagePositionToDraw,
    maskPositionToDraw,
    ctxMask: SHARED_CTX_CANVAS_MASK,
    canvasMask: SHARED_CANVAS_MASK,
    ctx: SHARED_CTX_CANVAS_OUTPUT
  });

  return _getImageResizedUsingBinary(
    SHARED_CANVAS_OUTPUT.toDataURL(), ...R.take(2, sizeCropper)
  );
}

export default class CanvasComposites extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.refCanvas = React.createRef();
    this.refCanvasForMask = React.createRef();
  }
  componentDidMount() {
    this.ctx2dCanvas = this.refCanvas.current.getContext("2d");
    this.ctx2dCanvasForMask = this.refCanvasForMask.current.getContext("2d");
    this._redrawCanvas();
  }
  static getDerivedStateFromProps(props) {
    return CanvasComposites.getDrawCompositesOptionsFromProps(
      props,
      ({ positionCropper }) => [positionCropper.width, positionCropper.height]
    );
  }
  static getDrawCompositesOptionsFromProps(props, getDrawSize = ({ sizeCropper }) => sizeCropper) {
    const {
      positionSourceImage,
      positionCropper,
      positionPercentageCropperMask,
      sizeCropper,
      ratio = 1
    } = props;
    const [widthCropper, heightCropper] = getDrawSize(props);
    const widthRatioCropper = (widthCropper * ratio) / positionCropper.width;
    const heightRatioCropper = (heightCropper * ratio) / positionCropper.height;
    return {
      domWidth: positionCropper.width,
      domHeight: positionCropper.height,
      canvasWidth: widthCropper * ratio,
      canvasHeight: heightCropper * ratio,
      imagePositionToDraw: [
        (positionSourceImage.x - positionCropper.x) * widthRatioCropper,
        (positionSourceImage.y - positionCropper.y)  * heightRatioCropper,
        positionSourceImage.width * widthRatioCropper,
        positionSourceImage.height * heightRatioCropper
      ],
      maskPositionToDraw: [
        widthCropper * ratio * positionPercentageCropperMask.xPercentage,
        heightCropper * ratio * positionPercentageCropperMask.yPercentage,
        widthCropper * ratio * positionPercentageCropperMask.widthPercentage,
        heightCropper * ratio * positionPercentageCropperMask.heightPercentage,
      ]
    }
  }
  componentDidUpdate() {
    this._redrawCanvas();
  }
  async _redrawCanvas() {
    const {
      cropperMaskSrc,
      sourceImageSrc,
    } = this.props;

    const {
      canvasWidth,
      canvasHeight,
      imagePositionToDraw,
      maskPositionToDraw
    } = this.state;

    const ctxMask = this.ctx2dCanvasForMask;

    const canvasMask = this.refCanvasForMask.current;

    const ctx = this.ctx2dCanvas;

    await drawComposites({
      cropperMaskSrc,
      sourceImageSrc,
      canvasWidth,
      canvasHeight,
      imagePositionToDraw,
      maskPositionToDraw,
      ctxMask,
      canvasMask,
      ctx
    })
  }
  render() {
    const {
      style,
      className
    } = this.props;
    const {
      canvasWidth,
      canvasHeight,
      domWidth,
      domHeight,
    } = this.state;

    // const [ maskWidth, maskHeight ] = R.takeLast(2, maskPositionToDraw);

    return <div className={className} style={style}>
      <div style={{ opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
        <canvas
          ref={this.refCanvasForMask}
          width={canvasWidth}
          height={canvasHeight}
          style={{ backgroundColor: "transparent", width: domWidth, height: domHeight }}
        />
      </div>
      <canvas
        ref={this.refCanvas}
        width={canvasWidth}
        height={canvasHeight}
        style={{ backgroundColor: "transparent", width: domWidth, height: domHeight }}
      />
    </div>;
  }
}
