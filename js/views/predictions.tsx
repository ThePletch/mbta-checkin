import _ from "lodash";
import { dateToTime, vehicleNameMap } from "../lib/helpers";
import { MbtaSchemas } from "../lib/types/mbta-api";
import { PredictionsByRouteAndDirection, Stop } from "../modules/mbta/stop";

type Prediction = MbtaSchemas["PredictionResource"];
type RouteResource = MbtaSchemas["RouteResource"];

const NOISY_ROUTE_DESCRIPTIONS = new Set([
  "Rapid Transit",
  "Commuter Rail",
  "Ferry",
]);

const HIDDEN_SCHEDULE_RELATIONSHIPS = new Set(["SKIPPED"]);

type UpcomingDeparture = {
  at: Date | null;
  lastTrip: boolean;
  status: string | null;
  cancelled: boolean;
};

function maybeDate(dateString: string | null): Date | null {
  if (dateString == null) {
    return null;
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function boardingTime(prediction: Prediction): Date | null {
  return maybeDate(prediction.attributes.departure_time)
    ?? maybeDate(prediction.attributes.arrival_time);
}

function upcomingDepartures(predictions: Prediction[]): UpcomingDeparture[] {
  const now = Date.now();
  return _.chain(predictions)
    .filter((prediction) => prediction.attributes.revenue_status !== "NON_REVENUE")
    .filter((prediction) => !HIDDEN_SCHEDULE_RELATIONSHIPS.has(prediction.attributes.schedule_relationship ?? ""))
    .map((prediction) => {
      const at = boardingTime(prediction);
      const cancelled = prediction.attributes.schedule_relationship === "CANCELLED";
      const status = prediction.attributes.status || null;
      if (at == null && !cancelled && !status) {
        return null;
      }
      if (at != null && at.getTime() <= now && !cancelled) {
        return null;
      }
      return {
        at,
        lastTrip: prediction.attributes.last_trip,
        status,
        cancelled,
      };
    })
    .compact()
    .sortBy((departure) => departure.at?.getTime() ?? Infinity)
    .value();
}

function countdownLabel(date: Date): { text: string; arriving: boolean } {
  const deltaMinutes = Math.floor((date.getTime() - Date.now()) / 60_000);
  if (deltaMinutes <= 0) {
    return { text: "Now", arriving: true };
  }
  if (deltaMinutes === 1) {
    return { text: "1 min", arriving: true };
  }
  return { text: `${deltaMinutes} min`, arriving: false };
}

function hexColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  return value.startsWith("#") ? value : `#${value}`;
}

function routeBadgeLabel(route: RouteResource): string | null {
  const shortName = route.attributes.short_name?.trim();
  const longName = route.attributes.long_name?.trim();
  if (!shortName || shortName.length > 5) {
    return null;
  }
  if (longName && longName.toLowerCase().includes(shortName.toLowerCase())) {
    return null;
  }
  return shortName;
}

function routeTitle(route: RouteResource): string {
  return route.attributes.long_name?.trim()
    || route.attributes.short_name?.trim()
    || route.id;
}

function routeSubtitle(route: RouteResource): string | null {
  if (route.attributes.fare_class === "Free") {
    return "Free";
  }
  const description = route.attributes.description?.trim();
  if (!description || NOISY_ROUTE_DESCRIPTIONS.has(description)) {
    return null;
  }
  if (description.toLowerCase() === routeTitle(route).toLowerCase()) {
    return null;
  }
  return description;
}

function vehicleLabel(route: RouteResource): string {
  return vehicleNameMap[route.attributes.type as keyof typeof vehicleNameMap] ?? "vehicles";
}

function stopSubtitle(stop: Stop): string | null {
  const attrs = stop.data.attributes;
  if (attrs.wheelchair_boarding === 2) {
    return "Not wheelchair accessible";
  }
  if (attrs.on_street && attrs.at_street && !attrs.name.includes(attrs.on_street)) {
    return `${attrs.on_street} at ${attrs.at_street}`;
  }
  return null;
}

function distinctFrom(value: string | null | undefined, ...others: Array<string | null | undefined>): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (others.some((other) => other?.trim().toLowerCase() === normalized)) {
    return null;
  }
  if (others.some((other) => other?.toLowerCase().includes(normalized))) {
    return null;
  }
  return value;
}

function DirectionTimes({ departures }: { departures: UpcomingDeparture[] }) {
  if (departures.length === 0) {
    return <span class="predictions-empty">No upcoming</span>;
  }
  if (departures.every((departure) => departure.cancelled)) {
    return <span class="predictions-empty">Cancelled</span>;
  }

  const next = departures.find((departure) => !departure.cancelled) ?? departures[0];
  if (next.at == null) {
    return (
      <div class="predictions-next">
        <span class="predictions-countdown">{next.status ?? "See schedule"}</span>
      </div>
    );
  }

  const countdown = countdownLabel(next.at);
  const later = departures
    .filter((departure) => departure !== next && !departure.cancelled && departure.at != null)
    .slice(0, 2)
    .map((departure) => countdownLabel(departure.at!).text);

  return (
    <div class="predictions-next">
      <span class={`predictions-countdown${countdown.arriving ? " is-now" : ""}`}>
        {countdown.text}
        {next.lastTrip ? <span class="predictions-pill">Last</span> : <></>}
      </span>
      <span class="predictions-clock">{dateToTime(next.at)}</span>
      {later.length > 0 ? <div class="predictions-later">then {later.join(", ")}</div> : <></>}
    </div>
  );
}

type PredictionsProps = {
  stop: Stop;
  predictions: PredictionsByRouteAndDirection;
};

export function Predictions(props: PredictionsProps) {
  const subtitle = stopSubtitle(props.stop);
  const routes = _.orderBy(
    Object.values(props.predictions).filter((routeInfo) => routeInfo?.route != null),
    (routeInfo) => routeInfo.route.attributes.sort_order,
  );

  const routeSections = routes.flatMap((routeInfo) => {
    const directions = _.sortBy(
      Object.entries(routeInfo.directions),
      ([directionId]) => directionId,
    ).flatMap(([directionId, direction]) => {
      const departures = upcomingDepartures(direction.predictions);
      if (departures.length === 0) {
        return [];
      }
      const headsign = direction.headsign;
      const compass = distinctFrom(direction.name, headsign, "Unknown direction");
      const platform = distinctFrom(
        direction.platform,
        headsign,
        props.stop.data.attributes.name,
        direction.name,
        routeTitle(routeInfo.route),
      );

      return [(
        <div class="predictions-direction" data-direction={directionId}>
          <div class="predictions-dest">
            <div class="predictions-headsign">{headsign}</div>
            {compass ? <div class="predictions-secondary">{compass}</div> : <></>}
            {platform ? <div class="predictions-secondary">{platform}</div> : <></>}
          </div>
          <DirectionTimes departures={departures} />
        </div>
      )];
    });

    if (directions.length === 0) {
      return [];
    }

    const route = routeInfo.route;
    const badge = routeBadgeLabel(route);
    const color = hexColor(route.attributes.color, "#777777");
    const textColor = hexColor(route.attributes.text_color, "#ffffff");
    const subtitleText = routeSubtitle(route);

    return [(
      <section class="predictions-route" style={{ borderLeftColor: color }}>
        <header class="predictions-route-header">
          {badge ? (
            <span class="predictions-route-badge" style={{ backgroundColor: color, color: textColor }}>
              {badge}
            </span>
          ) : <></>}
          <div class="predictions-route-title">
            <h3>{routeTitle(route)}</h3>
            {subtitleText ? <div class="predictions-secondary">{subtitleText}</div> : <></>}
          </div>
          <button class="track-route silver" data-route-id={route.id}>
            View {vehicleLabel(route)}
          </button>
        </header>
        {directions}
      </section>
    )];
  });

  return (
    <div class="predictions">
      <header class="predictions-stop">
        <h2>{props.stop.data.attributes.name}</h2>
        {subtitle ? <p class="predictions-stop-meta">{subtitle}</p> : <></>}
      </header>
      {routeSections.length > 0 ? routeSections : <p class="predictions-empty">No upcoming departures</p>}
    </div>
  );
}
