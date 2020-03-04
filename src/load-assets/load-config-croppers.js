import axios from "axios"
import json from "../../config_source_to_fragments_famale_croppers.json"

const URL_TO_CONFIG_CROPPERS = window.location.origin + window.location.pathname + '/config_source_to_fragments_famale_croppers.json';

export default async function() {
  return json;
  // const response = await axios.get(URL_TO_CONFIG_CROPPERS);
  // return response.data;
}
