//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/* example json:
 { name: "root",
 		opts:[
			{ name: "alpha",
				opts:[
					{ name: "beta", evt:"menuBeta", icon:"ui-icon-power" },
					{ name: "gamma", evt:"menuGamma" }
				]
			},
			{ name: "delta", evt:"menuDelta" },
			{	name: "epsilon", evt:"menuEpsilon" }
		]
 }
*/

var MenuView = Class.create({
	initializeWithJson: function( json ){
		this.div = this._parseRootMenuNode(json);

		var blockThis = this;
		//convert to menu
		this.div.menu({
			select: function(evt, ui){
				var evtName = ui.item.attr("name");
				if(!evtName) return;
				EventBus.ui.dispatch({evtName:evtName});
			},
			blur: function(evt, ui){
				//close the menu
				//console.log("TODO: menu lost focus, close");
				//blockThis.div.toggle(false);
			}
		});

		this.div.show().focus();
	},
	destroy: function(){
		this.div.remove();
	},
	_parseRootMenuNode: function( json ) {
		//first root node is special case (since it doesnt display a name)
		var name = json["name"];

		var root = jQuery("<ul>", {name:name });

		var blockThis = this;
		jQuery.each( json["opts"], function(key, value){
			var child = blockThis._rParseJsonMenuNode( value );
			root.append(child);
		});

		return root;
	},
	//recursive
	_rParseJsonMenuNode: function( json ) {
		var name = json["name"];
		var evtName = json["evt"];
		var root = jQuery("<li>", {name:evtName });

		if( json.hasOwnProperty("icon") ) {
			var iconSpan = jQuery("<span class='ui-icon "+json["icon"]+"'></span>");
			root.append(iconSpan);
		}

		root.append( name );

		if( json.hasOwnProperty("opts") ) {
			//this is a menu branch
			var subMenu = this._parseRootMenuNode( json );
			root.append(subMenu);
		}

		return root;
	},
	getDiv: function(){
		return this.div;
	}

})
