//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var MapNode = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.origX = 0;
		this.origY = 0;
		this.w = 100;
		this.h = 100;
		this.w_h = this.w/2;
		this.h_h = this.h/2;
		this.isHighlighted = false;
		this.div = jQuery("<div>", {"class":"tg-box tg-map-node", width:this.w, height:this.h});
		this.div.css("z-index",10);
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

		this.lblName.text("location");

		this.divIcons = jQuery("<div>");
		this.div.append(this.divIcons);

		var blockThis = this;
		this.div.click( function(evt){
			evt.stopPropagation();
			EventBus.ui.dispatch({evtName:"mapNodeClicked", node:blockThis});
		});

		this.div.bind('contextmenu', function(e) {
    	e.preventDefault();

			//send intent to move -- this will fail (gracefully) if not adjacent
			var locId = blockThis.updateTarget.id;
			EventBus.game.dispatch({evtName:"destination", value:locId});

		});

		EventBus.ui.addListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));
	},
	destroy: function($super) {
		$super();
		EventBus.ui.removeListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));
	},
	_updateFromModel: function( locModel ) {
		//console.log("map node for " + locModel.name);
		this.origX = locModel.coords.x;
		this.origY = locModel.coords.y;
		this.lblName.text( locModel.name );

		this._refreshIcons();
	},
	_refreshIcons: function() {
		this.divIcons.empty();
		if( dicLength(this.updateTarget.factories) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-arrowthickstop-1-s"));
		}
		if( dicLength(this.updateTarget.stations) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-transfer-e-w"));
		}
		if( dicLength(this.updateTarget.vessels) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-circlesmall-close"));
		}
	},
	_detachTarget: function( target ) {
		target.removeListener("vesselRemoved", this.onVesselsChanged.bind(this) );
		target.removeListener("vesselAdded", this.onVesselsChanged.bind(this) );
	},
	_attachTarget: function( target ) {
		//nothing
		target.addListener("vesselRemoved", this.onVesselsChanged.bind(this) );
		target.addListener("vesselAdded", this.onVesselsChanged.bind(this) );
	},
	setHighlighted: function( highlight ) {
		if( highlight ) {
			this.div.addClass("tg-border-hi-green");
			this.isHighlighted = true;
			EventBus.ui.dispatch({evtName:"MapNodeHighlight", node:this});
		}else {
			this.div.removeClass("tg-border-hi-green");
			this.isHighlighted = false;
		}
	},
	setScale: function( scale, animate ) {
		if( animate ) {
			TweenLite.to( this.div, 1, { scale:scale  });
		}else {
			this.div.css({'-webkit-transform': 'scale(' + scale + ')'});

		}
	},
	setPos: function( x, y, animate ) {
		if( animate ) {
			var unitsPerSecond = 2;
			var pos = this.getPos();
			var dx = pos.x - x;
			var dy = pos.y - y;
			var dist = (dx*dx + dy*dy)/2;
			TweenLite.to(this.div, 1, { left:x, top:y });
		}else {
			this.div.css({top:y, left:x});
		}
	},
	getPos: function() {
		var jqp = this.div.position();
		var pos = { x:jqp.left, y:jqp.top };
		return pos;
	},

	//Event handlers
	onSiblingHighlighted: function(evt){
		if( evt.node == this ) return;
		if(this.isHighlighted) {
			//turn off all other highlights
			this.setHighlighted(false);
		}
	},

	onVesselsChanged: function(evt){
		this._refreshIcons();
	}
});
