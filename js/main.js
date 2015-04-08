$(function(){
  helpers.events.bind('templates-rendered', function(){
    mapper.initialize();
    mbta.initialize();
    ui.initialize();
  });
});