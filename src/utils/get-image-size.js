export default async function getImageSize(src) {
  const img = document.createElement("img");
  return new Promise(resolve => {
    img.onload = () => {
      resolve([img.naturalWidth, img.naturalHeight])
    };
    img.setAttribute("src", src);
  })
}
