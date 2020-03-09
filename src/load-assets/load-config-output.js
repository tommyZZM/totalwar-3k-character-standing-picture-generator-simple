import axios from "axios"
import json from "../../config_output_paths.json"
import jsonSpecialCharacter from "../../configs/special_character_config_output_paths.json"

const URL_TO_CONFIG_OUTPUTS = window.location.origin + window.location.pathname + '/config_output_paths.json';

export async function loadConfigOutputFull() {
  return json;
  // const response = await axios.get(URL_TO_CONFIG_OUTPUTS);
  // return response.data;
}

export async function loadConfigOutputSpecial() {
  return jsonSpecialCharacter;
}
