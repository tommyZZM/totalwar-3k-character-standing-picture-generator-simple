import axios from "axios"
import json from "../../config_output_paths.json"

const URL_TO_CONFIG_OUTPUTS = window.location.origin + window.location.pathname + '/config_output_paths.json';

export default async function() {
  return json;
  // const response = await axios.get(URL_TO_CONFIG_OUTPUTS);
  // return response.data;
}
