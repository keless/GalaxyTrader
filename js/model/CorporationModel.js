//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/AgentModel.js

/*
  events sent
  [self]:"corpUpdateCredits": { corp:self }
	[self]:"corpUpdateAgents": { corp:self }
*/

var CorporationModel = Class.create(EventBus, {
	initialize: function( $super ) {
		$super("CorporationModel");
		this.name = "";
		this.id = "";
		this.agents = {};
		this._credits = 0;

		this.lastAgentProcessTime = 0;
		this.agentProcessPeriod = 5; //seconds
	},
	initializeWithJson: function( json ) {
    this.name = json["name"] || "Anon Corp";
    this.id = json["id"] || uuid.v4();
    this._credits = json["credits"] || 0;

    if( json["agents"] ) {
			var blockThis = this;
			var galaxySim = Service.get("galaxy");
			jQuery.each(json["agents"], function(key, value){
				var agent = new AgentModel();
				agent.initializeWithJson(value);
				agent.setCorporation(blockThis);
				blockThis.addAgent(agent);
			});
    }
    else {
			this.agents = {};
    }
  },
	addAgent: function( agent ) {
		this.agents[agent.id] = agent;
		agent.setCorporation( this );
		Service.get("galaxy").addAgent(agent);
		this.dispatch({evtName:"corpUpdateAgents", corp:this});
	},
	getAgent: function( agentId ) {
		return this.agents[agentId];
	},
	toJson: function() {
		var agents = [];
		var blockThis = this;
		jQuery.each(this.agents, function(key, value){
			agents.push( value.toJson() );
		});
		var json = { name:this.name, id:this.id, credits:this._credits,
								agents:agents
               };
    return json;
	},
  getNumCredits: function() {
    return this._credits;
  },
	incCredits: function( delta ) {
		this._credits += ~~(delta); //force int
		if( this._credits < 0 ) {
			console.log("CorpModel:incCredits - went below zero " + this._credits);
			this._credits = 0;
		}

		var blockThis = this;
		this.dispatch({evtName:"corpUpdateCredits", corp:blockThis});
	},

	update: function( currTime, dt ) {

		var blockThis = this;

		if( currTime > this.lastAgentProcessTime + this.agentProcessPeriod ) {
      jQuery.each(this.agents, function(key, value){
        value.update( currTime, blockThis.agentProcessPeriod );
      });

      this.lastAgentProcessTime = currTime;
    }
	}


});
