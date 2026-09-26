import { initializeUi } from "./modules/ui";
import Mapper from "./modules/mapper";

window.onload = async function () {
  initializeUi();
  await google.maps.importLibrary('maps');
  await google.maps.importLibrary('geometry');
  const mapper = Mapper();
  await mapper.initializeDefaultFeatures();
};
