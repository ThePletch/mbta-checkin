$(function(){
  Helpers.events.bind('prep-complete', function(){
    Mbta.initialize();
    Mapper.initialize();
    Ui.initialize();
  });
});
