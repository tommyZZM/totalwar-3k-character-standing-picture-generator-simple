import React from "react";

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
SHARED_CTX_CANVAS_OUTPUT.imageSmoothingEnabled = false;

export async function getImageResized(src, width, height) {
  const sourceImg = await getImageLoaded(src);

  SHARED_CANVAS_OUTPUT.setAttribute("width", width);
  SHARED_CANVAS_OUTPUT.setAttribute("height", height);
  SHARED_CANVAS_OUTPUT.style.cssText = "background: transparent";

  SHARED_CTX_CANVAS_OUTPUT.globalCompositeOperation = 'source-over';
  SHARED_CTX_CANVAS_OUTPUT.clearRect(0, 0, width, height);
  SHARED_CTX_CANVAS_OUTPUT.drawImage(sourceImg, 0, 0, width, height);

  return SHARED_CANVAS_OUTPUT.toDataURL();
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
    ctx
  } = options;

  const sourceImg = await getImageLoaded(sourceImageSrc);
  const maskImg = await getImageLoaded(cropperMaskSrc);

  if (maskImg) {
    ctxMask.clearRect(0, 0, canvasWidth, canvasHeight);
    ctxMask.strokeStyle = "none";
    ctxMask.drawImage(maskImg, ...maskPositionToDraw);

    const [x, y, w, h] = maskPositionToDraw;
    const imageDataMask = ctxMask.getImageData(
      x, y, w + 2, h + 2
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
  ctx.drawImage(sourceImg, ...imagePositionToDraw);
  ctx.globalCompositeOperation = 'source-over';
}

export async function getImageCompositesBy(options) {
  const {
    canvasWidth,
    canvasHeight,
    imagePositionToDraw,
    maskPositionToDraw
  } = CanvasComposites.getDerivedStateFromProps(options, {});

  SHARED_CANVAS_MASK.setAttribute("width", canvasWidth);
  SHARED_CANVAS_MASK.setAttribute("height", canvasHeight);
  SHARED_CANVAS_MASK.style.cssText = "background: transparent";

  SHARED_CANVAS_OUTPUT.setAttribute("width", canvasWidth);
  SHARED_CANVAS_OUTPUT.setAttribute("height", canvasHeight);
  SHARED_CANVAS_OUTPUT.style.cssText = "background: transparent";

  await drawComposites({
    ...options,
    canvasWidth,
    canvasHeight,
    imagePositionToDraw,
    maskPositionToDraw,
    ctxMask: SHARED_CTX_CANVAS_MASK,
    canvasMask: SHARED_CANVAS_MASK,
    ctx: SHARED_CTX_CANVAS_OUTPUT
  });

  return SHARED_CANVAS_OUTPUT.toDataURL();
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
  static getDerivedStateFromProps(props, state) {
    const {
      positionSourceImage,
      positionCropper,
      positionPercentageCropperMask
    } = props;
    return {
      canvasWidth: positionCropper.width,
      canvasHeight: positionCropper.height,
      imagePositionToDraw: [
        positionSourceImage.x - positionCropper.x,
        positionSourceImage.y - positionCropper.y,
        positionSourceImage.width,
        positionSourceImage.height
      ],
      maskPositionToDraw: [
        positionCropper.width * positionPercentageCropperMask.xPercentage,
        positionCropper.height * positionPercentageCropperMask.yPercentage,
        positionCropper.width * positionPercentageCropperMask.widthPercentage,
        positionCropper.height * positionPercentageCropperMask.heightPercentage,
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
    } = this.state;

    // const [ maskWidth, maskHeight ] = R.takeLast(2, maskPositionToDraw);

    return <div className={className} style={style}>
      <div style={{ opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
        <canvas
          ref={this.refCanvasForMask}
          width={canvasWidth}
          height={canvasHeight}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
      <canvas
        ref={this.refCanvas}
        width={canvasWidth}
        height={canvasHeight}
        style={{ backgroundColor: "transparent" }}
      />
    </div>;
  }
}
