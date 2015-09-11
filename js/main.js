$(function(){
  Helpers.events.bind('prep-complete', function(){
    Mapper.initialize();
    Mbta.initialize();
    Ui.initialize();
    console.log(jsonData);
  });
});
