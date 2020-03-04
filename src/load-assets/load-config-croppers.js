import axios from "axios"

const URL_TO_CONFIG_CROPPERS = window.location.origin + window.location.pathname + '/config_source_to_fragments_famale_croppers.json';

export default async function() {
  const response = await axios.get(URL_TO_CONFIG_CROPPERS);
  return response.data;
}
