import type { paths } from './mbta-paths';
import createClient from 'openapi-fetch';

const Mbta = createClient<paths>({
  baseUrl: 'https://api-v3.mbta.com'
});

const { data: result, error } = await Mbta.GET('/stops');
result?.data[0].attributes