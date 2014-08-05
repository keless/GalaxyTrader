//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js
//#include js/view/MenuView.js


var PlayerHud = Class.create({
	initialize: function() {
		this.agent = null;
		this.menu = null;

		this.div = jQuery("<div>", {"class":"top-hud", width:"100%", height:"50px"}); //note: class here is the HTML-element-class

		//todo: push the following off to the right

		this.lblName = jQuery("<p>", {"class":"leftAlignText"}).css({
    position:  'absolute',
    left:      160});
    this.div.append(this.lblName);

		this.lblCredits = jQuery("<p>", {"class":"rightAlignText"});
		this.div.append(this.lblCredits);

		//calls createMenu on getDiv() to allow for reloading at different locations
	},
	destroy: function() {
		this.setUpdateTarget(null);
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
									{ name: "-"},
									{ name: "Save Game", evt:"menuSaveGame" },
									{ name: "Load Game", evt:"menuLoadGame" },
									{ name: "Export", evt:"menuExportGame" },
									{	name: "Nuke", evt:"menuNuke", icon:"ui-icon-power" }
					]}
				]
		 });
		this.div.append(this.menu.getDiv());
	},
	updateFromModel: function( agentModel, setAsUpdateTarget ) {
		if(setAsUpdateTarget) {
      this.setUpdateTarget( agentModel );
    }

		this.lblName.text( agentModel.name );
		this.setCredits( agentModel.getNumCredits() );

	},
	getDiv: function() {
		this.createMenu();
		return this.div;
	},
	setCredits: function( amt ) {
		this.lblCredits.text( "$" + amt );
	},
  setUpdateTarget: function( agentModel ) {
    if( this.updateTarget != null ) {
      this.updateTarget.removeListener("agentUpdateCredits", this.onVesselAdded.bind(this) );
		}

		this.updateTarget = agentModel;
		if(agentModel == null) return;

    agentModel.addListener("agentUpdateCredits", this.onAgentCreditsUpdated.bind(this) );
  },
	onAgentCreditsUpdated: function( evt ) {
		console.log("update credits");
		this.setCredits( this.updateTarget.getNumCredits() );
	}
})
