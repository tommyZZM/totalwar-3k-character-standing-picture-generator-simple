import axios from "axios"
import json from "../../config_output_paths.json"
import jsonTiny from "../../configs/tiny_config_output_paths.json"

const URL_TO_CONFIG_OUTPUTS = window.location.origin + window.location.pathname + '/config_output_paths.json';

export async function loadConfigOutputFull() {
  return json;
  // const response = await axios.get(URL_TO_CONFIG_OUTPUTS);
  // return response.data;
}

export async function loadConfigOutputTiny() {
  return jsonTiny;
}
