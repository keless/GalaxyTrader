//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js
//#include js/view/MenuView.js


var PlayerHud = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.menu = null;

		this.div = jQuery("<div>", {"class":"top-hud", width:"100%", height:"50px"}); //note: class here is the HTML-element-class

		//todo: push the following off to the right

		this.lblName = jQuery("<p>", {"class":"leftAlignText"}).css({
    position:  'absolute',
    left:      160});
    this.div.append(this.lblName);

		this.selAgents = null;

		this.lblCredits = jQuery("<p>", {"class":"rightAlignText"});
		this.div.append(this.lblCredits);

		this.createMenu();
		//calls createMenu on getDiv() to allow for reloading at different locations
	},
	createMenu: function() {

		if( this.menu != null ) {
			//destroy previous menu
			this.menu.destroy();
			this.menu = null;
		}

		this.menu = new MenuView();
		this.menu.initializeWithJson({ name: "root",
					opts:[{ name: "Menu", opts:[
									{ name: "Run",
										opts:[
											{ name: "Pause", evt:"menuPause" },
											{ name: "Resume", evt:"menuResume" }
										]
									},
                  {
                    name: "Create",
                    opts:[
                      { name: "Location", evt:"menuCreateLocation" },
                      { name: "Destination", evt:"menuCreateDestination" },
                      { name: "Factory", evt:"menuCreateFactory" },
                      { name: "Station", evt:"menuCreateStation" },
											{ name: "-" },
											{ name: "Corporation", evt:"menuCreateCorporation" },
											{ name: "Agent", evt:"menuCreateAgent" },
											{ name: "Vessel", evt:"menuCreateVessel" }
                    ]
                  },
									{ name: "-"},
									{ name: "Export", evt:"menuExportGame" },
                  { name: "Import", evt:"menuImportGame" },
									{	name: "Nuke", evt:"menuNuke", icon:"ui-icon-power" }
					]}
				]
		 });
		this.div.append(this.menu.getDiv());
	},
	updateCredits: function( amt ) {
		this.lblCredits.text( "$" + amt );
	},
	_updateFromModel: function( corpModel ) {

		if(this.selAgents) {
			this.selAgents.remove();
		}

		if( corpModel ) { //be extra fault tolerant during THE REMAKING
			this.lblName.text( corpModel.name );
			this.updateCredits( corpModel.getNumCredits() );

			if( dicLength(corpModel.agents) > 0 ) {
				var agentVals = [];
				jQuery.each(corpModel.agents, function(key, value){
					agentVals.push({ value:value.id, text:value.name});
				});

				var player = Service.get("player");
				var activeAgent = undefined;
				if( player.activeUserAgent ) {
					activeAgent = player.activeUserAgent.id;
				}

				this.selAgents = create_select_div(agentVals, activeAgent);
				this.selAgents.css({
						position:  'absolute',
						left:      360});
				this.div.append(this.selAgents);

				this.selAgents.change(function(e){
					var selectedValue = jQuery(this).val();
					EventBus.ui.dispatch({ evtName:"activeAgentSelected", agentId:selectedValue });
				});
			}

		}else {
			//Nuked, reset all labels
			this.lblName.text("");
		}
	},
	_detachTarget: function( target ) {
		this.updateTarget.removeListener("corpUpdateCredits", this.onCorpCreditsUpdated.bind(this) );
		this.updateTarget.removeListener("corpUpdateAgents", this.onCorpAgentsUpdated.bind(this) );
	},
	_attachTarget: function( target ) {
		this.updateTarget.addListener("corpUpdateCredits", this.onCorpCreditsUpdated.bind(this) );
		this.updateTarget.addListener("corpUpdateAgents", this.onCorpAgentsUpdated.bind(this) );
	},

	//event handlers
	onCorpCreditsUpdated: function( evt ) {
		this.updateCredits( this.updateTarget.getNumCredits() );
	},
	onCorpAgentsUpdated: function( evt ) {
		this._updateFromModel( this.updateTarget );
	},
})
