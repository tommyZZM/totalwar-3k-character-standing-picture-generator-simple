import { render } from "react-dom";
import React from "react";
import "./polyfill/hidpi-canvas";

process.platform = "darwin";

const App = require("./app").default;

render(<App/>, document.getElementById("app"));
