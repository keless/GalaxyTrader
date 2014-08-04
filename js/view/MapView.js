//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var svgLineBetweenPts = function( x1, y1, x2, y2, r,g,b )
{
	var w = Math.abs( x1 - x2 );
	var h = Math.abs( y1 - y2 );

	//always left to right
	if( x2 > x1 ) {
		//swap points
		var tx = x1;
		x1 = x2;
		x2 = tx;
		var ty = y1;
		y1 = y2;
		y2 = ty;
	}

	var oy1 = 0; //topleft origin default
	var oy2 = h;

	//should origin be top left or bottom left?
	if( y1 > y2 ) {
		//origin is bottom-left
		oy1 = h;
		oy2 = 0;
	}

	var div = jQuery("<svg width='"+w+"' height='"+h+"'><line x1='0' y1='"+oy1+"' x2='"+w+"' y2='"+oy2+"' style='stroke:rgb("+r+","+g+","+b+");stroke-width:2' /></svg>").addClass("tg-map-node");

	//add utility function to know where to place this in absolute pixels
	div.getWorldPosition = function() {
		return { x: x1, y: y1 + oy1 };
	}

	div.setPos = function( x, y ) {
		this.css({top:y+"px", left:x+"px"});
	}

	return div;
}

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
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

		this.lblName.text("location");

		var blockThis = this;
		this.div.click( function(evt){
			evt.stopPropagation();
			EventBus.ui.dispatch({evtName:"mapNodeClicked", node:blockThis});
		});

		EventBus.ui.addListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));
	},
	destroy: function($super) {
		$super();
		EventBus.ui.removeListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));

	},
	_updateFromModel: function( locModel ) {
		this.origX = locModel.coords.x;
		this.origY = locModel.coords.y;
		this.lblName.text( locModel.name );
		console.log("map node for " + locModel.name);
	},
	_attachTarget: function( target ) {
		//nothing
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
	}
});

var MapView = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.w = 720;
		this.w_h = this.w/2;
		this.h = 720;
		this.h_h = this.h/2;
		this.div = jQuery("<div>", {"class":"tg-box tg-map-base", width:this.w, height:this.h, position:"relative"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

		this.nodes = [];
		this.lines = [];
		this.scroll = { x:-1*this.w_h, y:-1*this.h_h };

		this.drag = null;

		var blockThis = this;

		/*
		this.div.click( function(evt){
			var parentOffset = blockThis.div.offset();
			console.log(" offset of "+ parentOffset.left+","+parentOffset.top)
      var posX = (evt.pageX - parentOffset.left);
      var posY = (evt.pageY - parentOffset.top);

			var offX = blockThis.div.width()/2 - posX;
			var offY = blockThis.div.height()/2 - posY;

			//blockThis.node.setPos( relativeXPosition, relativeYPosition );
			blockThis.scrollMapBy( -offX/2, -offY/2 );
		})
		*/
		this.div.mousedown( function(evt){
			if( blockThis.drag == null ) {
				var parentOffset = blockThis.div.offset();
      	var posX = (evt.pageX - parentOffset.left);
      	var posY = (evt.pageY - parentOffset.top);
				blockThis.drag = { x:posX, y:posY };
				evt.preventDefault();
			}
		})
		this.div.mousemove( function(evt){
			if( blockThis.drag != null ) {
				var parentOffset = blockThis.div.offset();
      	var posX = (evt.pageX - parentOffset.left);
      	var posY = (evt.pageY - parentOffset.top);
				var dx = blockThis.drag.x - posX;
				var dy = blockThis.drag.y - posY;
				blockThis.drag.x = posX;
				blockThis.drag.y = posY;
				blockThis.scrollMapBy(dx, dy);
				evt.preventDefault();
			}
		})
		this.div.mouseup( function(evt){
			if( blockThis.drag != null ) {
				blockThis.drag = null;
			}
		})
		this.div.mouseleave( function(evt){
			if( blockThis.drag != null ) {
				blockThis.drag = null;
			}
		})
		this.lblName.text( "Universe" );

		EventBus.ui.addListener("mapNodeClicked", this.onNodeClicked.bind(this));
	},
	destroy: function($super) {
		$super();

		EventBus.ui.removeListener("mapNodeClicked", this.onNodeClicked.bind(this));

		jQuery.each( this.nodes, function(key, value){
			value.destroy();
		});
	},
	initializeWithGalaxySim: function( galaxy ) {
		var blockThis = this;

    this.scrollMapTo( -1*this.w_h, -1*this.h_h); //center to zero-zero

		jQuery.each( galaxy.locations, function(key, value){
			var node = new MapNode();
			//node.initializeWithJson(value);
			node.updateFromModel( value, true );
			node.setPos( node.origX - blockThis.scroll.x, node.origY - blockThis.scroll.y );
			blockThis.div.append( node.getDiv() );
			blockThis.nodes.push( node );
		});


	},
  setCurrentLocation: function( locModel ) {
    var blockThis = this;
    jQuery.each( this.nodes, function(key, value){
      if( value.updateTarget == locModel ) {
        value.setHighlighted(true);
        blockThis.scrollToNode( value );
        return false;
      }

    });
  },
  scrollToNode: function( node ) {
    this.scrollMapTo(  (node.origX) - this.w_h  , (node.origY) - this.h_h );
  },
	scrollMapBy: function( x, y, animate ) {
		this.scroll.x += x;
		this.scroll.y += y;

		this._updateAfterScroll();
	},
	scrollMapTo: function( x, y, animate ) {
		this.scroll.x = x;
		this.scroll.y = y;

		this._updateAfterScroll();
	},
	_updateAfterScroll: function(){

		//TODO: setup tween
		var cx = this.w_h;
		var cy = this.h_h;

		//update existing nodes
		var blockThis = this;
		jQuery.each( this.nodes, function(idx, value){
			var nx = value.origX;// + blockThis.w_h;
			var ny = value.origY;// + blockThis.h_h;

			var dx = Math.abs(cx - nx + blockThis.scroll.x );
			var dy = Math.abs(cy - ny + blockThis.scroll.y );
			var axis = (dx + dy)/2;
			var scale = 1 - (axis / cx);
			if( scale < 0.2 ) scale = 0.2;

			//set scale based on distance from center of view

			//clip to inside of view area  all sides
			var x = nx - blockThis.scroll.x;
			var y = ny - blockThis.scroll.y;
			if( x < value.w_h ) x = value.w_h;
			if( x >= blockThis.w - value.w ) x = blockThis.w - value.w;
			if( y < value.h_h ) y = value.h_h;
			if( y >= blockThis.h - value.h ) y = blockThis.h - value.h;
			value.setPos( x - value.w_h, y - value.h_h, true );


			value.setScale( scale, true );
		});

		this.lblName.text( "Universe (" + (this.scroll.x + this.w_h )+","+ (this.scroll.y+this.h_h)+")");
	},
	onNodeClicked: function(evt){
    this.scrollToNode( evt.node );
    //evt.node.setHighlighted(true);
	}
});
