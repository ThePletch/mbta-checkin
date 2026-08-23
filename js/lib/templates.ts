import Handlebars from "handlebars";

export type TemplateArguments = {
  // this isn't up to date with how we handle predictions
  'prediction-info': {
    stop_name: string;
    predictions: {
      this: {
        name: string;
        vehicleName: string;
        directions: {
          name: string;
        }
      }[]
    }[]
  }
};

const formats = {
  locales: "en-US",
  formats: {
    time: {
      hhmm: {
        hour: "numeric",
        minute: "numeric"
      }
    },
    relative: {
      minutes: {
        units: "minute"
      }
    }
  }
};

const compiledTemplates: {
  [K in keyof TemplateArguments]?: Handlebars.TemplateDelegate<TemplateArguments[K]>;
} = {};

export async function renderTemplate<K extends keyof TemplateArguments>(
  template: K,
  payload: TemplateArguments[K],
): Promise<string> {
  if (!compiledTemplates[template]) {
    const response = await fetch(`hb/${template}.hdbs`);
    if (!response.ok) {
      throw new Error(`Failed to load template ${template}: ${response.statusText}`);
    }
    compiledTemplates[template] = Handlebars.compile(await response.text());
  }

  return compiledTemplates[template](payload, {
    data: {
      intl: formats,
    }
  });
}