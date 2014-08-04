//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include js/framework/EventDispatcher

var GameEngine = Class.create({
  initialize : function() {
    //TODO
  }
});

function getRand(min, max) {
  return ~~(Math.random() * (max - min + 1)) + min
}

function jQueryIcon( strName ) {
	return jQuery("<span class='ui-icon "+strName+"' style='display:inline-block'></span>");
}
