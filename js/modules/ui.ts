import { bind, fire } from "../lib/events";
import { renderTemplate, TemplateArguments } from "../lib/templates";
import { RouteId } from "../lib/types/mbta";
import { getUserLocation } from "./app";
import { PredictionsByRouteAndDirection, updateVehicleLocations } from "./mbta";
import { Route } from "./mbta/route";

type IndicatorStatus = 'loading' | 'error' | 'success';

const modal = {
  selector: "#modal-info",
  wrapperSelector: "#modal-info-wrapper",
  slideTransitionMs: 500,
};

const iconUrls = {
  statusLoading: 'img/spinner.gif',
  statusSuccess: 'img/success.png',
  statusError: 'img/error.png'
};

const statusIndicatorSelector = "#status-indicator";
function setStatus(status: IndicatorStatus, tooltip?: string) {
  const newImg = {
    "loading": iconUrls.statusLoading,
    "error": iconUrls.statusError,
    "success": iconUrls.statusSuccess,
  }[status] ?? "?";
  $(statusIndicatorSelector).attr("src", newImg);
  $(statusIndicatorSelector).attr("title", tooltip || "");
}

export function renderPredictions(predictions: PredictionsByRouteAndDirection[]) {
  console.log(predictions);
  // displayModal("prediction-info", predictions);
}

export function initializeUi() {
  bindButtons();
  bindToggles();

  bind("api-call-sent", () => {
    setStatus("loading");
  });

  bind("api-call-completed", () => {
    setStatus("success");
  });

  bind("api-call-error", (error?: string) => {
    setStatus("error", error);
  });
}

function bindButtons() {
  $("#zoom-location").on('click', getUserLocation);
}

function bindToggles() {
  $("[data-toggle]").on('click', function () {
    const target = $(this).attr("data-toggle");
    const jqTarget = $(`#${target}`);

    jqTarget.slideToggle();
    jqTarget.toggleClass("open");
  });
  $("[data-close]").on('click', function () {
    const target = $(this).attr("data-close")!;
    closeElement(target);
  });
}

function bindModalButtons() {
  $(".track-route").on('click', async function () {
    const routeId = $(this).attr("data-route-id") as RouteId;
    const route = await Route.byId(routeId);
    await updateVehicleLocations(route);
    closeElement("modal-info-wrapper");
    fire('modal-closed');
  });
}

function closeElement(target: string) {
  $(`#${target}`).removeClass("visible");
}

async function displayModal<K extends keyof TemplateArguments>(templateName: K, dataObject: TemplateArguments[K]) {
  $(modal.wrapperSelector).removeClass("visible");
  setTimeout(async () => {
    const templateMarkup = await renderTemplate(templateName, dataObject);

    $(modal.selector).html(templateMarkup);
    $(modal.wrapperSelector).addClass("visible");
    bindModalButtons();
  }, modal.slideTransitionMs);
}
