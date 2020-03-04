import axios from "axios"

const URL_TO_CONFIG_OUTPUTS = window.location.origin + window.location.pathname + '/config_output_paths.json';

export default async function() {
  const response = await axios.get(URL_TO_CONFIG_OUTPUTS);
  return response.data;
}
