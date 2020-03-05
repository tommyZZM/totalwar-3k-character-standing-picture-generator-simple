import * as R from "ramda"
import React from "react"
import { Button, Spin, Upload, Table, Radio, Checkbox, Tooltip, Modal, Input, message } from "antd"
import SelectFile, { VirtualFile } from "./components/SelectFile"
import {
  PlusCircleOutlined,
  InboxOutlined,
  BarcodeOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import loadConfigWithCroppers from "./load-assets/load-config-croppers"
import { Rnd } from "react-rnd"
import CanvasComposites from "./components/CanvasComposites"
import loadConfigOutput from "./load-assets/load-config-output"
import makeOutputArchiveFile from "./make-output-archive-file"
import { saveAs } from 'file-saver'
import getImageSize from "./utils/get-image-size";

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

class OutputModalContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filledParams: {},
      filledParamsError: {
        type: false,
        gender: false,
        file_name: false
      }
    };
  }
  storageKey = key => `placeholder_path_params_${key}`
  componentDidMount() {
    const {
      onChange = () => null
    } = this.props;
    const filledParams = {
      type: localStorage.getItem(this.storageKey('type')),
      gender: localStorage.getItem(this.storageKey('gender')),
      file_name: localStorage.getItem(this.storageKey('file_name'))
    };
    this.setState({ filledParams });
    onChange(filledParams);
  }
  render() {
    const {
      onChange = () => null,
      onChangeOneKeySuccess = () => null
    } = this.props;
    const {
      filledParams,
      filledParamsError
    } = this.state;

    return <div>
      <div>ui/characters/<b>{`{{type}}`}</b>/<b>{`{{gender}}`}</b>/.../<b>{`{{file_name}}`}.png</b></div>
      {R.keys(filledParams).map((key, index) => {
        return <label className={"modal-label"} key={key}><b>{key}:</b>
          <Input
            value={filledParams[key]}
            className={`modal-input has-error-${filledParamsError[key]}`}
            onChange={(e) => {
              const value = e.target.value;
              const isValidValue = /^[\w\-._\$]+$/.test(value);

              localStorage.setItem(this.storageKey(key), value);

              this.setState({
                filledParams: {
                  ...filledParams,
                  [key]: value,
                },
                filledParamsError: {
                  ...filledParamsError,
                  [key]: value,
                }
              })

              onChange(filledParams);

              if (isValidValue) {
                onChangeOneKeySuccess(key)
              }
            }} />
        </label>;
      })}
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
      mappingCurrentCropperPositions: {}
    };
    this.refImage = React.createRef();
    this.refCropper = React.createRef();
  }
  componentDidMount() {
    (async () => {
      this.setState({ isInitialLoading: true });
      const configWithCroppers = await loadConfigWithCroppers();
      const configOutput = await loadConfigOutput();

      this._applyConfigWithCroppers(configWithCroppers);

      this.setState({
        isInitialLoading: false,
        configOutput,
      });
    })();
  }
  _applyConfigWithCroppers = (configWithCroppers) => {
    const { imagePosition, croppers: configCroppers = [] } = configWithCroppers;
    const rect = this.refCropper.current.getBoundingClientRect();

    // console.log('_applyConfigWithCroppers', configWithCroppers);

    if (R.isEmpty(configWithCroppers)) {
      throw new Error("croppers can't be null");
    }

    this.setState({
      configCroppers,
      currentImagePosition: imagePosition,
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
            ...positionInitial,
            ...R.filter(R.compose(R.not, R.isNil), R.pick(['x', 'y', 'width', 'height'], ref)),
            maskUrl: ref.maskUrl,
            maskLock: true, //ref.maskLock,
            maskIsShow: false, // Boolean(ref.maskUrl),
            ...R.pick([
              'maskLock',
              'maskIsShow',
              'maskPreview',
              'isShowRef',
            ], ref.maskPosition || {}),
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
    this.setState({ isFilePicking: false });
    const dataUrl = await vf.readAsDataUrl();
    const [width, height] = await getImageSize(dataUrl);
    const rect = this.refCropper.current.getBoundingClientRect();
    const imagePosition = getImageInitialPosition(
      width, height, rect.width, rect.height
    );
    this.setState({
      isFilePicking: true,
      currentImageDataUrlReadOnly: dataUrl,
      currentImagePosition: imagePosition,
      // mappingCurrentCropperPositions: {}
    });
  }
  _exportZippedPath = async () => {
    await new Promise((resolve, reject) => {
      let filledParams = {};

      const modal = Modal.confirm({
        title: "填写路径参数",
        okText: "导出",
        okButtonProps: {
          disabled: true
        },
        cancelText: "取消",
        onCancel: () => { reject(); },
        content: <OutputModalContent
          onChangeOneKeySuccess={() => {
            modal.update({
              okButtonProps: {
                disabled: R.values(filledParams).filter(Boolean).length !==
                  R.keys(filledParams).length
              }
            });
          }}
          onChange={filledParamsEdited => {
            filledParams = filledParamsEdited;
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
            mappingCurrentCropperPositions
          });

          saveAs(blob, zipFileName);
        },
      })
    });
  }
  render() {
    const {
      currentImageDataUrlReadOnly,
      isInitialLoading = false,
      currentImagePosition,
      mappingCurrentCropperPositions,
      configCroppers = [],
      currentCropperkey
    } = this.state;

    const refCurrentCropper = mappingCurrentCropperPositions[currentCropperkey] || {};

    const positionCurrentCropper = R.pick(["x", "y", "width", "height"], refCurrentCropper);

    // console.log("refCurrentCropper?.maskPosition", refCurrentCropper?.maskPosition);

    return <Spin wrapperClassName={"spin-fill"} spinning={isInitialLoading}>
      <div className={"editor"}>
        <div className={"left"}>
          <div ref={this.refCropper} className={"left-cropper"}>
            {
              currentImageDataUrlReadOnly ?
                <Rnd
                  enableResizing={refCurrentCropper?.maskLock}
                  disableDragging={refCurrentCropper?.maskLock}
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
                    await this._handleUpdateFile(vf);
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
                cropperMaskSrc={refCurrentCropper.maskUrl}
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
              const isEditing = this.state.currentCropperkey === key;
              const maskPosition = refPatch?.maskPosition;
              // console.log("maskPosition", maskPosition);
              return <Rnd
                key={key + index}
                className={`rnd-crop-item editing-${!!isEditing}`}
                style={{
                  ...!refPatch.maskLock && {
                    pointerEvents: "none"
                  }
                }}
                // enableResizing={isEditing}
                // disableDragging={!isEditing}
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
                  <div className={"name"}>{ref.name || key}</div>
                  <div
                    className={"background-ref"}
                    style={{
                      backgroundImage: `url(./assets-background-ref/${key}.png)`,
                      opacity: refPatch.isShowRef ? 0.66 : 0
                    }}
                  />
                  {refPatch.maskUrl && <div
                    className={`mask-wrap ` +
                      // `has-mask-${Boolean(refPatch.maskUrl)} ` +
                      `is-mask-show-${Boolean(refPatch.maskIsShow)} ` +
                      `is-mask-lock-${Boolean(refPatch.maskLock)} `
                    }
                    onMouseDown={stopPropagation}
                  >
                    <Rnd
                      className={`mask `}
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
                                width: Math.min(1, ref.offsetWidth / position.width),
                                height: Math.min(1, ref.offsetHeight / position.height),
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
              <SelectFile onSelectFiles={async ({ virtualFiles }) => {
                const [vf] = virtualFiles;
                await this._handleUpdateFile(vf);
              }}>
                <Button type={"primary"}>
                  <PlusCircleOutlined />
                  <span>{currentImageDataUrlReadOnly ? "选择新" : "选择"}图片</span>
                </Button>
              </SelectFile>
            </div>
            <div style={{ marginBottom: 10 }}>
              <SelectFile accept={'application/json'} onSelectFiles={async ({ virtualFiles }) => {
                const [vf] = virtualFiles;
                const jsonString = await vf.readAsText();
                this._applyConfigWithCroppers(JSON.parse(jsonString));
                message.success('剪裁配置已读取');
              }}>
                <Button style={{ marginRight: 10 }}>导入剪裁配置</Button>
              </SelectFile>
              <Button onClick={this._exportZippedPath}>导出结果包</Button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <Table
                rowKey={item => item[0]}
                onRow={(record) => {
                  return {
                    onClick: () => {
                      const [key] = record;
                      const isChecked = key === this.state.currentCropperkey;
                      this.setState({
                        currentCropperkey: isChecked ? null : key
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
                              <SelectFile disabled={!isChecked} onSelectFiles={async ({ virtualFiles }) => {
                                // const [vf] = virtualFiles;
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
                            <span style={{
                              marginRight: 5
                            }} onClick={stopPropagation}>
                              <div><Checkbox
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
                              >蒙层移动</Checkbox></div>
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
                              >蒙层预览</Checkbox></div>
                            </span>
                            <span onClick={stopPropagation}>
                              <Tooltip title={"删除蒙层"}>
                                <Button
                                  // disabled={!refPatch.maskUrl && !isChecked}
                                  disabled={true}
                                  size={"small"}
                                  type={"danger"}
                                  icon={<DeleteOutlined />}
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
