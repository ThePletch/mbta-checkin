import { bind, EventsWithNoArgs, fire } from "../lib/events";
import { Predictions } from "../views/predictions";
import { getUserLocation } from "./app";
import { PredictionsByRouteAndDirection, Stop } from "./mbta/stop";

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

export function renderPredictions(stop: Stop, predictions: PredictionsByRouteAndDirection) {
  displayModal(Predictions, { stop, predictions });
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
    const eventName = $(this).attr("data-close-event")!;
    if (eventName != null) {
      fire(eventName as EventsWithNoArgs);
    }
    closeElement(target);
  });
}

function bindModalButtons() {
  $(".track-route").on('click', async function () {
    const routeId = $(this).attr("data-route-id");
    if (routeId == null) {
      throw new Error("Clicked on a track-route button without a data-route-id attribute");
    }
    fire("track-route", routeId);
    closeElement("modal-info-wrapper");
    fire('modal-closed');
  });
}

let modalShowTimeout: ReturnType<typeof setTimeout> | undefined;

function cancelPendingModalShow() {
  if (modalShowTimeout == null) {
    return;
  }
  clearTimeout(modalShowTimeout);
  modalShowTimeout = undefined;
}

function closeElement(target: string) {
  if (`#${target}` === modal.wrapperSelector) {
    cancelPendingModalShow();
  }
  $(`#${target}`).removeClass("visible");
}

export async function displayModal<K>(template: (props: K) => JSX.Element, props: K) {
  cancelPendingModalShow();
  $(modal.wrapperSelector).removeClass("visible");
  modalShowTimeout = setTimeout(async () => {
    modalShowTimeout = undefined;
    $(modal.selector).html(template(props).toString());
    $(modal.wrapperSelector).addClass("visible");
    bindModalButtons();
  }, modal.slideTransitionMs);
}
