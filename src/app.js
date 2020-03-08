import * as R from "ramda"
import React from "react"
import { Button, Spin, Upload, Table, Radio, Checkbox, Tooltip, Modal, Input, message } from "antd"
import SelectFile, { VirtualFile } from "./components/SelectFile"
import {
  PlusCircleOutlined,
  InboxOutlined,
  BarcodeOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  CheckCircleOutlined,
  ExpandOutlined
} from "@ant-design/icons";
import loadConfigWithCroppers from "./load-assets/load-config-croppers"
import { Rnd } from "react-rnd"
import CanvasComposites from "./components/CanvasComposites"
import loadConfigOutput from "./load-assets/load-config-output"
import makeOutputArchiveFile from "./make-output-archive-file"
import { saveAs } from 'file-saver'
import getImageSize from "./utils/get-image-size";
import readArchiveFileTakeMajorConfig from "./read-archive-file";

const stopPropagation = (e) => { e.stopPropagation(); };

function getImageInitialPosition(naturalWidth, naturalHeight, containerWidth, containerHeight,
  sizeRatio = 0.6
) {
  const height = (containerHeight * sizeRatio);
  const width = height * (naturalWidth / naturalHeight);
  const x = containerWidth / 2 - width / 2;
  const y = containerHeight / 2 - height / 2;
  return { x, y, width, height }
}

function getCropperInitialPosition(originWidth, originHeight, containerWidth, containerHeight) {
  const position = getImageInitialPosition(
    originWidth, originHeight, containerWidth, containerHeight, 0.3
  );
  return { ...position, x: 0, y: 0 }
}

const REGEX_VAILD_FILENAME = () => /^[\w\-_\$]+$/;

const pathParamsStorageKey = key => `placeholder_path_params_${key}`

const reactRndEnableResizing = boo => ({
  bottom: boo,
  bottomLeft: boo,
  bottomRight: boo,
  left: boo,
  right: boo,
  top: boo,
  topLeft: boo,
  topRightboo: boo
})

class OutputModalContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filledParams: {},
      filledParamsError: {
        type: false,
        gender: false,
        file_name: false
      },
      outPutName: null
    };
  }
  componentDidMount() {
    const {
      onChange = () => null,
      // onChangeOneKeySuccess = () => null
    } = this.props;
    const filledParams = {
      type: sessionStorage.getItem(pathParamsStorageKey('type')),
      gender: sessionStorage.getItem(pathParamsStorageKey('gender')),
      file_name: sessionStorage.getItem(pathParamsStorageKey('file_name')),
    };
    this.setState({ 
      filledParams,
      // outPutName: sessionStorage.getItem(this.pathParamsStorageKey('outPutName')),
    }, () => {
      // const { outPutName } = this.state;

      const isValidFilledParams = R.values(filledParams).filter(value => {
        return value && REGEX_VAILD_FILENAME().test(value);
      }).length === R.keys(filledParams).length;

      // const isValidOutputName = !outPutName || REGEX_VAILD_FILENAME().test(outPutName);

      onChange(
        filledParams,
        null, // outPutName || filledParams.file_name,
        isValidFilledParams
      );
    });
  }
  render() {
    const {
      onChange = () => null,
      // onChangeOneKeySuccess = () => null
    } = this.props;
    const {
      filledParams,
      filledParamsError,
      outPutName
    } = this.state;

    const isHasError = R.values(filledParamsError).some(Boolean);

    return <div>
      <div>ui/characters/<b>{`{{type}}`}</b>/<b>{`{{gender}}`}</b>/.../<b>{`{{file_name}}`}.png</b></div>
      {R.keys(filledParams).map((key, index) => {
        const keyName = key;
        if (key === 'output_name') {
          keyName = '{{名称}}.tar'
        }
        return <label className={"modal-label"} key={key}><b>{keyName}:</b>
          <Input
            value={filledParams[key]}
            className={`modal-input has-error-${filledParamsError[key]}`}
            onChange={(e) => {
              const value = e.target.value;
              const isValidValue = REGEX_VAILD_FILENAME().test(value);

              sessionStorage.setItem(pathParamsStorageKey(key), value);

              this.setState({
                filledParams: {
                  ...filledParams,
                  [key]: value,
                },
                filledParamsError: {
                  ...filledParamsError,
                  [key]: !isValidValue,
                }
              }, () => {
                onChange(
                  {
                    ...this.state.filledParams,
                  },
                  this.state.outPutName || null,
                  !R.values(this.state.filledParamsError).some(Boolean)
                );
              })
            }} />
        </label>;
      })}
      {/* <label className={"modal-label"}><b>{`{{保存}}.tar`}:</b>
        <Input
          value={outPutName}
          className={`modal-input has-error-${filledParamsError.outPutName}`}
          placeholder={`{{file_name}}`}
          onChange={(e) => {
            const value = e.target.value;
            const isValidValue = !value || REGEX_VAILD_FILENAME().test(value);

            sessionStorage.setItem(pathParamsStorageKey('outPutName'), value);

            this.setState({
              outPutName: R.value,
              filledParamsError: {
                ...filledParamsError,
                outPutName: !isValidValue,
              }
            }, () => {
              onChange(
                {
                  ...this.state.filledParams,
                }, 
                this.state.outPutName || null,
                R.values(this.state.filledParamsError).some(Boolean)
              );
            })
          }} />
      </label> */}
      {isHasError && <small style={{ color: '#e74c3c' }}>文件名只允许数字、文字、-、_、$</small>}
    </div>;
  }
}

export default class extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isInitialLoading: true,
      configCroppers: [],
      configOutput: null,
      currentImageDataUrlReadOnly: null,
      currentImagePosition: {},
      mappingCurrentCropperPositions: {},
      flagOperationTarget: 0,
      mappingCurrentCropperMaskPositionsDefault: {}
    };
    this.refImage = React.createRef();
    this.refCropper = React.createRef();
  }
  componentDidMount() {
    (async () => {
      this.setState({ isInitialLoading: true });
      const configWithCroppers = await loadConfigWithCroppers();
      const configOutput = await loadConfigOutput();

      this.setState({
        configWithCroppersDefault: configWithCroppers
      }, () => {
        this._applyConfigWithCroppers(configWithCroppers);
        this.setState({
          isInitialLoading: false,
          configOutput,
        });
      })
    })();
  }
  _applyConfigWithCroppers = (configWithCroppers, isResetSize = true) => {
    const { imagePosition = {}, croppers: configCroppersIn = [] } = configWithCroppers;
    const rect = this.refCropper.current.getBoundingClientRect();

    const { croppers: configCroppersDefault = [] } = this.state.configWithCroppersDefault;

    // console.log('_applyConfigWithCroppers', configWithCroppers);

    if (R.isEmpty(configWithCroppers)) {
      throw new Error("croppers can't be null");
    }

    const configCroppers = configCroppersDefault.map(([key, ref]) => {
      const [_, refFound = {}] = R.find(R.propEq(0, key), configCroppersIn) || [];
      const isSameSize = R.equals(refFound.size, ref.size);
      // console.log(isSameSize);
      return [key, {
        ...ref,
        ...isSameSize && refFound,
        copy: ref.copy,
        maskPositionDefault: { ...ref.maskPosition }
      }];
    })

    this.setState({
      configCroppers,
      currentImagePosition: {
        ...this.state.currentImagePosition,
        ...R.pick(['x', 'y'], imagePosition),
        ...isResetSize && R.pick(['width', 'height'], imagePosition)
      },
      mappingCurrentCropperMaskPositionsDefault: configCroppers.reduce((result, [key, ref]) => {
        return {
          ...result,
          [key]: {
            x: 0,
            y: 0,
            ...ref.maskPositionDefault
          }
        }
      }, {}),
      mappingCurrentCropperPositions: configCroppers.reduce((result, [key, ref]) => {
        const [originWidth, originHeight] = ref.size;
        const {
          x: maskPositionX = 0,
          y: maskPositionY = 0,
          width: maskPositionWidth = 0.5,
          height: maskPositionHeight = 0.5,
        } = ref.maskPosition || {};
        const positionInitial = getCropperInitialPosition(
          originWidth, originHeight, rect.width, rect.height
        );
        return {
          ...result,
          [key]: {
            size: ref.size,
            ...positionInitial,
            ...R.filter(R.compose(R.not, R.isNil), R.pick(['x', 'y', 'width', 'height'], ref)),
            isShowRef: true,
            maskUrl: ref.maskUrl,
            // maskLock: true, //ref.maskLock,
            maskIsShow: true, // Boolean(ref.maskUrl),
            ...R.pick([
              // 'maskLock',
              'maskIsShow',
              'maskPreview',
              'isShowRef',
              'maskIsEnable'
            ], ref),
            maskPosition: {
              ...ref.maskPosition,
              x: maskPositionX,
              y: maskPositionY,
              width: maskPositionWidth,
              height: maskPositionHeight
            }
          }
        }
      }, {})
    });
  }
  _handleUpdateFile = async (vf) => {
    this.setState({ isFilePicking: true });
    const dataUrl = await vf.readAsDataUrl();
    const [width, height] = await getImageSize(dataUrl);
    const rect = this.refCropper.current.getBoundingClientRect();
    let imagePosition = getImageInitialPosition(
      width, height, rect.width, rect.height
    );
    if (this.state.currentImageDataUrlReadOnly) {
      const lastWidth = this.state.currentImagePosition.width;
      const lastHeight = this.state.currentImagePosition.height;
      imagePosition = {
        ...R.pick(['x', 'y'], this.state.currentImagePosition),
        width: lastHeight * (width / height),
        height: lastHeight
      }
    }
    return new Promise(resolve => {
      this.setState({
        isFilePicking: false,
        currentImageDataUrlReadOnly: dataUrl,
        currentImagePosition: imagePosition,
        // mappingCurrentCropperPositions: {}
      }, () => resolve());
    })
  }
  _exportZippedPath = async () => {
    await new Promise((resolve, reject) => {
      let filledParams = {};
      let outputName = null;

      const modal = Modal.confirm({
        title: "填写路径参数",
        okText: "导出",
        okButtonProps: {
          disabled: true
        },
        cancelText: "取消",
        onCancel: () => { reject(); },
        content: <OutputModalContent
          onChange={(
            filledParamsEdited,
            outputNameEdited = filledParamsEdited?.file_name,
            success
          ) => {
            filledParams = filledParamsEdited;
            outputName = outputNameEdited;
            // console.log(filledParamsEdited, outputNameEdited, 'success', success)
            modal.update({
              okButtonProps: {
                disabled: !success
              }
            });
          }}
        />,
        onOk: async () => {
          const {
            currentImagePosition,
            currentImageDataUrlReadOnly,
            configCroppers,
            configOutput,
            mappingCurrentCropperPositions
          } = this.state;

          const [blob, zipFileName] = await makeOutputArchiveFile({
            currentImageDataUrlReadOnly,
            pathParams: filledParams,
            configCroppers,
            configOutput,
            positionSourceImage: R.pick(["x", "y", "width", "height"], currentImagePosition),
            mappingCurrentCropperPositions,
            outputName
          });

          saveAs(blob, zipFileName);
        },
      })
    });
  }
  _applyConfigFromArchiveFile = async (vf) => {
    // console.log('_applyConfigFromArchiveFile 1...', vf);
    this.setState({ isFilePicking: true });
    try {
      const {
        targetFileNameWithoutExtension,
        vfileSourceImage,
        configWithCroppers
      } = await readArchiveFileTakeMajorConfig(vf);
      if (!vfileSourceImage || !configWithCroppers) {
        throw new Error('{{file}}.png and {{file}}.cropper.config.json not found');
      }
      await this._handleUpdateFile(vfileSourceImage);
      await this._applyConfigWithCroppers(configWithCroppers);
      // console.log('after _applyConfigFromArchiveFile', this.state.currentImagePosition)
      const { pathParams } = configWithCroppers;
      sessionStorage.setItem(pathParamsStorageKey('file_name'), targetFileNameWithoutExtension);
      for (const [key, value] of R.toPairs(pathParams)) {
        sessionStorage.setItem(pathParamsStorageKey(key), value);
      }
      message.success(`读取数据完成`);
    } catch (error) {
      message.error(`读取数据遇到异常: ${error.message}`);
    } finally {
      this.setState({ isFilePicking: false });
    }
  }
  render() {
    const {
      currentImageDataUrlReadOnly,
      isFilePicking = false,
      isInitialLoading = false,
      currentImagePosition,
      mappingCurrentCropperPositions,
      configCroppers = [],
      currentCropperkey,
      flagOperationTarget,
      mappingCurrentCropperMaskPositionsDefault
    } = this.state;

    const refCurrentCropper = mappingCurrentCropperPositions[currentCropperkey] || {};

    const positionCurrentCropper = R.pick(["x", "y", "width", "height"], refCurrentCropper);

    // console.log("refCurrentCropper?.maskPosition", refCurrentCropper?.maskPosition);

    return <Spin wrapperClassName={"spin-fill"} spinning={isInitialLoading || isFilePicking}>
      <div className={"editor"}>
        <div className={"left"}>
          <div ref={this.refCropper} className={"left-cropper"}>
            {
              currentImageDataUrlReadOnly ?
                <Rnd
                  enableResizing={reactRndEnableResizing(flagOperationTarget === 0)}
                  disableDragging={flagOperationTarget !== 0}
                  lockAspectRatio={true}
                  size={{ ...currentImagePosition }}
                  position={{ ...currentImagePosition }}
                  onDragStop={(e, d) => {
                    this.setState({
                      currentImagePosition: {
                        ...currentImagePosition,
                        x: d.x,
                        y: d.y
                      }
                    });
                  }}
                  onResize={(e, direction, ref, delta, position) => {
                    this.setState({
                      currentImagePosition: {
                        ...currentImagePosition,
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                      }
                    });
                  }}
                >
                  <div className={"fixture"}>
                    <img
                      style={{
                        ...refCurrentCropper.maskPreview && {
                          opacity: 0.06
                        }
                      }}
                      ref={this.refImage}
                      src={currentImageDataUrlReadOnly}
                    />
                  </div>
                </Rnd> :
                <Upload.Dragger
                  style={{ width: 230, height: 230 }}
                  action={null}
                  fileList={[]}
                  beforeUpload={async (file) => {
                    const vf = new VirtualFile(file);
                    if (vf.type.startsWith('image/')) {
                      await this._handleUpdateFile(vf);
                    } else if (vf.type === 'application/zip') {
                      await this._applyConfigFromArchiveFile(vf);
                    } else {
                      message.error('所选文件格式不正确')
                    }
                  }}
                  showUploadList={false}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">上传角色图片原图</p>
                </Upload.Dragger>
            }
            {refCurrentCropper.maskPreview &&
              <CanvasComposites
                className={"preview-cropper-selected"}
                style={{
                  opacity: refCurrentCropper.maskPreview ? 1 : 0,
                  pointerEvents: refCurrentCropper.maskPreview ? "none" : "initial",
                  transform: `translate(${positionCurrentCropper.x}px, ${positionCurrentCropper.y}px)`
                }}
                sourceImageSrc={currentImageDataUrlReadOnly}
                positionSourceImage={R.pick(["x", "y", "width", "height"], currentImagePosition)}
                positionCropper={positionCurrentCropper}
                cropperMaskSrc={refCurrentCropper.maskIsEnable ? refCurrentCropper.maskUrl : null}
                positionPercentageCropperMask={{
                  xPercentage: refCurrentCropper?.maskPosition.x,
                  yPercentage: refCurrentCropper?.maskPosition.y,
                  widthPercentage: refCurrentCropper?.maskPosition.width,
                  heightPercentage: refCurrentCropper?.maskPosition.height,
                }}
              />
            }
            {!!currentImageDataUrlReadOnly && configCroppers.map(([key, ref], index) => {
              const [originWidth, originHeight] = ref.size;
              const refPatch = mappingCurrentCropperPositions[key];
              const position = R.pick(["x", "y", "width", "height"], refPatch);
              const isBeingSelected = this.state.currentCropperkey === key;
              const maskPosition = refPatch?.maskPosition;
              // console.log("maskPosition", maskPosition);
              // console.log('isBeingSelected', isBeingSelected);
              return <Rnd
                key={key + index}
                className={`rnd-crop-item editing-${!!isBeingSelected} ` + 
                  `editiong-cropper-flag-${isBeingSelected ? flagOperationTarget : null}`
                }
                enableResizing={reactRndEnableResizing(flagOperationTarget === 1)}
                disableDragging={flagOperationTarget !== 1}
                lockAspectRatio={true}
                size={{
                  width: originWidth,
                  height: originHeight,
                  ...position
                }}
                position={{ ...position }}
                onDragStop={(e, d) => {
                  this.setState({
                    mappingCurrentCropperPositions: {
                      ...mappingCurrentCropperPositions,
                      [key]: {
                        ...refPatch,
                        x: d.x,
                        y: d.y
                      }
                    }
                  });
                }}
                onResize={(e, direction, ref, delta) => {
                  this.setState({
                    mappingCurrentCropperPositions: {
                      ...mappingCurrentCropperPositions,
                      [key]: {
                        ...refPatch,
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                      }
                    }
                  });
                }}
              >
                <div className={`crop-item`}>
                  <div className={`crop-item-frame`}>
                    <div className={"name"}>{ref.name || key}</div>
                    <div
                      className={"background-ref"}
                      style={{
                        backgroundImage: `url(./assets-background-ref/${key}.png)`,
                        opacity: refPatch.isShowRef ? 0.66 : 0
                      }}
                    />
                  </div>
                  {refPatch.maskUrl && refPatch.maskIsEnable && <div
                    className={`mask-wrap ` + ""
                      // `has-mask-${Boolean(refPatch.maskUrl)} ` +
                      // `is-mask-show-${Boolean(refPatch.maskIsShow)} ` +
                      // `is-mask-lock-${Boolean(refPatch.maskLock)} `
                      // `is-mask-show-true is-mask-lock-false`
                    }
                    onMouseDown={stopPropagation}
                  >
                    <Rnd
                      enableResizing={reactRndEnableResizing(flagOperationTarget === 2)}
                      disableDragging={flagOperationTarget !== 2}
                      className={`mask `}
                      style={{
                        ...flagOperationTarget === 2 && isBeingSelected && {
                          opacity: 1,
                          pointerEvents: 'initial'
                        }
                      }}
                      size={{
                        width: position.width * maskPosition.width,
                        height: position.height * maskPosition.height,
                      }}
                      position={{
                        x: (position.width * maskPosition.x),
                        y: (position.height * maskPosition.y),
                      }}
                      onDragStop={(e, d) => {
                        this.setState({
                          mappingCurrentCropperPositions: {
                            ...mappingCurrentCropperPositions,
                            [key]: {
                              ...refPatch,
                              maskPosition: {
                                ...maskPosition,
                                x: (d.x) / position.width,
                                y: (d.y) / position.height,
                              }
                            }
                          }
                        });
                      }}
                      onResize={(e, direction, ref, delta) => {
                        this.setState({
                          mappingCurrentCropperPositions: {
                            ...mappingCurrentCropperPositions,
                            [key]: {
                              ...refPatch,
                              maskPosition: {
                                ...maskPosition,
                                width: ref.offsetWidth / position.width,
                                height: ref.offsetHeight / position.height,
                              }
                            }
                          }
                        });
                      }}
                    >
                      <div className={"mask-img"} style={{ backgroundImage: `url(${refPatch.maskUrl})` }} />
                    </Rnd>
                  </div>}
                </div>
              </Rnd>
            })}
          </div>
        </div>
        <div className={"right-sider-bar"}>
          <React.Fragment>
            <div style={{ marginBottom: 10 }}>
              <SelectFile accept={"image/*"}
                onSelectFilesWithError={() => message.error('仅支持图片文件')}
                onSelectFiles={async ({ virtualFiles }) => {
                  const [vf] = virtualFiles;
                  await this._handleUpdateFile(vf);
                }}
              >
                <Button type={"primary"}>
                  <PlusCircleOutlined />
                  <span>{currentImageDataUrlReadOnly ? "选择新" : "选择"}图片</span>
                </Button>
              </SelectFile>
            </div>
            <div style={{ marginBottom: 10 }}>
              <SelectFile
                accept={'application/json,application/zip'}
                onSelectFilesWithError={() => message.error('所选文件格式不正确')}
                onSelectFiles={async ({ virtualFiles }) => {
                  const [vf] = virtualFiles;
                  const jsonString = await vf.readAsText();
                  if (vf.type === 'application/json') {
                    this._applyConfigWithCroppers(JSON.parse(jsonString), false);
                    message.success('剪裁配置已读取');
                  } else if (vf.type === 'application/zip') {
                    this._applyConfigFromArchiveFile(vf);
                  }
                }}
              >
                <Button>导入...</Button>
              </SelectFile>
              <Button
                style={{ marginLeft: 10 }}
                disabled={!currentImageDataUrlReadOnly}
                onClick={this._exportZippedPath}
              >导出</Button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <b style={{ marginRight: 10 }}>操作对象:</b>
              <Radio.Group disabled={!currentImageDataUrlReadOnly} onChange={(e) => {
                this.setState({
                  flagOperationTarget: e.target.value
                })
              }} buttonStyle="solid" value={flagOperationTarget}>
                <Radio.Button value={0}>图片</Radio.Button>
                <Radio.Button value={1}>剪裁</Radio.Button>
                <Radio.Button value={2}>蒙层</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ marginBottom: 10 }}>
              <Table
                rowKey={item => item[0]}
                onRow={(record) => {
                  return {
                    onClick: () => {
                      if (!currentImageDataUrlReadOnly) {
                        return null;
                      }
                      const [key] = record;
                      const isCheckedLast = key === this.state.currentCropperkey;
                      this.setState({
                        currentCropperkey: isCheckedLast ? null : key,
                        flagOperationTarget: isCheckedLast ? 0 : 1
                      })
                    }
                  }
                }}
                columns={[
                  {
                    title: "剪裁输出",
                    key: "key",
                    dataIndex: "key",
                    render: (_, record) => {
                      const [key] = record;
                      const isChecked = key === this.state.currentCropperkey;
                      const refPatch = mappingCurrentCropperPositions[key];
                      return <div className={"table-cropper-item"}>
                        <Radio className={"radio"} checked={isChecked} />
                        <div className={"name"}>
                          <div title={`${key}.png`} className={"text-name"}>{key}.png</div>
                          <div className={"options"} style={{
                            ...!isChecked && {
                              pointerEvents: "none"
                            }
                          }}>
                            <span style={{ marginRight: 5 }} onClick={stopPropagation}>
                              <Checkbox
                                disabled={!isChecked}
                                checked={refPatch.isShowRef} onChange={(e) => {
                                  this.setState({
                                    mappingCurrentCropperPositions: {
                                      ...mappingCurrentCropperPositions,
                                      [key]: {
                                        ...refPatch,
                                        isShowRef: e.target.checked
                                      }
                                    }
                                  });
                                }}>参考位置</Checkbox>
                            </span>
                            <span style={{ marginRight: 5 }} onClick={stopPropagation}>
                              <SelectFile accept={"image/*"} disabled={!isChecked} onSelectFiles={async ({ virtualFiles }) => {
                                const [vf] = virtualFiles;
                                const dataUrl = await vf.readAsDataUrl();
                                this.setState({
                                  mappingCurrentCropperPositions: {
                                    ...mappingCurrentCropperPositions,
                                    [key]: {
                                      ...refPatch,
                                      maskUrl: dataUrl
                                    }
                                  }
                                });
                                // TODO:
                              }}>
                                <Tooltip title={refPatch.maskUrl ? <React.Fragment>
                                  <small>修改蒙层</small>
                                  <div className={"options-mask-shape"}>
                                    <img src={refPatch.maskUrl} />
                                  </div>
                                </React.Fragment> : <small>添加蒙层</small>}>
                                  <Button
                                    className={`btn-with-mask-${Boolean(refPatch.maskUrl)}`}
                                    style={{ marginRight: 5 }}
                                    size={"small"}
                                    icon={<BarcodeOutlined />}
                                  />
                                </Tooltip>
                              </SelectFile>
                            </span>
                            <span style={{ marginRight: 5 }} onClick={stopPropagation}>
                              {/* <div><Checkbox
                                disabled={!isChecked}
                                checked={!refPatch.maskLock}
                                onChange={(e) => {
                                  this.setState({
                                    mappingCurrentCropperPositions: {
                                      ...mappingCurrentCropperPositions,
                                      [key]: {
                                        ...refPatch,
                                        maskLock: !e.target.checked,
                                        maskIsShow: e.target.checked
                                      }
                                    }
                                  });
                                }}
                              >蒙层移动</Checkbox></div> */}
                              <div><Checkbox
                                disabled={!isChecked}
                                checked={refPatch.maskPreview}
                                onChange={(e) => {
                                  this.setState({
                                    mappingCurrentCropperPositions: {
                                      ...mappingCurrentCropperPositions,
                                      [key]: {
                                        ...refPatch,
                                        maskPreview: e.target.checked
                                      }
                                    }
                                  });
                                }}
                              >剪裁预览</Checkbox></div>
                            </span>
                            <span style={{ marginRight: 5 }} onClick={stopPropagation}>
                              <Tooltip title={"重置蒙层位置"}>
                                <Button
                                  // disabled={!refPatch.maskUrl && !isChecked}
                                  // disabled={refPatch.maskIsEnable}
                                  onClick={() => {
                                    const maskPositionDefault = mappingCurrentCropperMaskPositionsDefault[key];
                                    // console.log('maskPositionDefault', maskPositionDefault);
                                    this.setState({
                                      mappingCurrentCropperPositions: {
                                        ...mappingCurrentCropperPositions,
                                        [key]: {
                                          ...refPatch,
                                          maskPosition: {
                                            ...refPatch.maskPosition,
                                            ...maskPositionDefault,
                                          }
                                        }
                                      }
                                    });
                                  }}
                                  size={"small"}
                                  icon={<ExpandOutlined />}
                                />
                              </Tooltip>
                            </span>
                            <span onClick={stopPropagation}>
                              <Tooltip
                                title={refPatch.maskIsEnable ?
                                  "禁用蒙层" : "启用蒙层"}
                              >
                                <Button
                                  // disabled={!refPatch.maskUrl && !isChecked}
                                  // disabled={refPatch.maskIsEnable}
                                  onClick={() => {
                                    this.setState({
                                      mappingCurrentCropperPositions: {
                                        ...mappingCurrentCropperPositions,
                                        [key]: {
                                          ...refPatch,
                                          maskIsEnable: !refPatch.maskIsEnable
                                        }
                                      }
                                    });
                                  }}
                                  {...refPatch.maskIsEnable && {
                                    type: "danger"
                                  }}
                                  size={"small"}
                                  icon={refPatch.maskIsEnable ?
                                    <MinusCircleOutlined /> :
                                    <CheckCircleOutlined />
                                  }
                                />
                              </Tooltip>
                            </span>
                          </div>
                        </div>
                      </div>;
                    }
                  }
                ]}
                dataSource={configCroppers}
                pagination={false}
              />
            </div>
          </React.Fragment>
        </div>
      </div>
    </Spin>;
  }
}
