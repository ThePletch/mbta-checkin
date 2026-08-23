import { MbtaClient } from "../modules/mbta";

const foo = await MbtaClient.GET('/routes/:id', {
  params: {
    path: {
      id: 'eee'
    },
    query: {
      include: 'line'
    }
  }
});