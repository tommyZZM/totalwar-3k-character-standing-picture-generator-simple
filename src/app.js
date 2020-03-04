import * as R from "ramda"
import React from "react"
import { Button, Spin, Upload, Table, Radio, Checkbox, Tooltip, Modal, Input } from "antd"
import SelectFile, { VirtualFile } from "./components/SelectFile"
import {
  PlusCircleOutlined,
  InboxOutlined,
  BarcodeOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import loadConfigCroppers from "./load-assets/load-config-croppers"
import { Rnd } from "react-rnd"
import CanvasComposites from "./components/CanvasComposites"
import loadConfigOutput from "./load-assets/load-config-output"
import makeOutputZipFile from "./make-output-zip-file"
import { saveAs } from 'file-saver'

const stopPropagation = (e) => { e.stopPropagation(); };

async function getImageSizeFromDataUrl(dataUrl) {
  const img = document.createElement("img");
  return new Promise(resolve => {
    img.onload = () => {
      resolve([img.naturalWidth, img.naturalHeight])
    };
    img.setAttribute("src", dataUrl);
  })
}

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
      const configCroppers = await loadConfigCroppers();
      const configOutput = await loadConfigOutput();
      const rect = this.refCropper.current.getBoundingClientRect();
      this.setState({
        isInitialLoading: false,
        configCroppers,
        configOutput,
        mappingCurrentCropperPositions: configCroppers.reduce((result, [key, ref]) => {
          const [originWidth, originHeight] = ref.size;
          const [
            originMaskWidth = originWidth * 0.5,
            originMaskHeight = originWidth * 0.5
          ] = ref.maskSize || [];
          const positionInitial = getCropperInitialPosition(
            originWidth, originHeight, rect.width, rect.height
          );
          return {
            ...result,
            [key]: {
              ...positionInitial,
              maskUrl: ref.maskUrl,
              maskLock: true, //ref.maskLock,
              maskIsShow: false, // Boolean(ref.maskUrl),
              maskPosition: {
                x: 0,
                y: 0,
                width: originMaskWidth / originWidth,
                height: originMaskHeight / originHeight
              }
            }
          }
        }, {})
      });
    })();
  }
  _handleUpdateFile = async (vf) => {
    this.setState({ isFilePicking: false });
    const dataUrl = await vf.readAsDataUrl();
    const [width, height] = await getImageSizeFromDataUrl(dataUrl);
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
      const filledParams = {
        type: null,
        gender: null,
        file_name: null
      };
      const modal = Modal.confirm({
        title: "填写路径参数",
        okText: "导出",
        okButtonProps: {
          disabled: true
        },
        cancelText: "取消",
        onCancel: () => { reject(); },
        content: <div>
          <div>ui/characters/<b>{`{{type}}`}</b>/<b>{`{{gender}}`}</b>/.../<b>{`{{file_name}}`}.png</b></div>
          {R.keys(filledParams).map((key, index) => {
            return <label className={"modal-label"} key={key}><b>{key}:</b><Input className={"modal-input"} onChange={(e) => {
              const value = e.target.value;
              filledParams[key] = value;
              modal.update({
                okButtonProps: {
                  disabled: R.values(filledParams).filter(Boolean).length !==
                    R.keys(filledParams).length
                }
              });
            }} /></label>;
          })}
        </div>,
        onOk: async () => {
          const {
            currentImagePosition,
            currentImageDataUrlReadOnly,
            configCroppers,
            configOutput,
            mappingCurrentCropperPositions
          } = this.state;

          const [blob, zipFileName] = await makeOutputZipFile({
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
                  enableResizing={!refCurrentCropper.maskLock}
                  disableDragging={refCurrentCropper.maskLock}
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
              <Button disabled={true} style={{ marginRight: 10 }}>导入剪裁配置</Button>
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
