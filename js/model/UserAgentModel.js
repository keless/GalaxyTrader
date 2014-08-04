//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/AgentModel.js

var UserAgentModel = Class.create(AgentModel, {
  initialize: function($super){
		$super();
		this.AiMethod = this._UserListenerUpdate.bind(this);
	},
	toJson: function($super) {
		var json = $super();
		json["isUserAgent"] = true;
		return json;
	},
	_UserListenerUpdate: function( currTime, dt ) {

	}
});
