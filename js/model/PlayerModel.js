//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js

var PlayerModel = Class.create(EventBus, {
  initialize: function( $super ) {
		this.currentLocation = "";

		Service.add("player", this);
	},
	toJson: function() {
		var json = { currentLocation:this.currentLocation };
		return json;
	},
	initializeWithJson: function( json ) {
		this.currentLocation = json["currentLocation"];
	}
});
