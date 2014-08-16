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

var DotNode = Class.create(BaseView, {
	initialize: function( worldX, worldY ) {
		this.div = jQueryIcon("ui-icon-radio-off").addClass("tg-map-node").css({top:100, left:100, "z-index":2 });
		this.origX = worldX;
		this.origY = worldY;
		this.w = 10;
		this.h = 10;
		this.w_h = this.w/2;
		this.h_h = this.h/2;
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
			//this.div.css("background-position-x",x);
			//this.div.css("background-position-y",y);
		}
	},
	getPos: function() {
		var jqp = this.div.position();
		var pos = { x:jqp.left, y:jqp.top };
		return pos;
	}
});


//fromto is unique per str1<->str2 pair
var uniqueFromTo = function( str1, str2 ) {
	return str1.localeCompare(str2) ? (str1+str2) : (str2+str1);
}

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
		this.dotNodes = [];
		this.linkMap = {};
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
		this.div.bind('contextmenu', function(e) {
    	e.preventDefault();
		});
		this.lblName.text( "Universe" );

		EventBus.ui.addListener("mapNodeClicked", this.onNodeClicked.bind(this));
    EventBus.game.addListener("playerDiscoveredLocation", this.onDiscoveredLocation.bind(this));
	},
	destroy: function($super) {
		$super();

		this.linkMap = {};

		EventBus.ui.removeListener("mapNodeClicked", this.onNodeClicked.bind(this));
    EventBus.game.removeListener("playerDiscoveredLocation", this.onDiscoveredLocation.bind(this));

		jQuery.each( this.nodes, function(key, value){
			value.destroy();
		});
		this.nodes = [];

		jQuery.each( this.dotNodes, function(key, value){
			value.destroy();
		});
		this.dotNodes = [];
	},
	initializeWithGalaxySim: function( galaxy ) {

		//clean up previous attachment
		this.linkMap = {};
		jQuery.each( this.nodes, function(key, value){
			value.destroy();
			value.getDiv().remove();
		});
		this.nodes = [];
		jQuery.each( this.dotNodes, function(key, value){
			value.destroy();
			value.getDiv().remove();
		});
		this.dotNodes = [];
		///

		var blockThis = this;

    var cx = this.w_h;
		var cy = this.h_h;

    //this.scrollMapTo( -1*this.w_h, -1*this.h_h, false); //center to zero-zero
    var player = Service.get("player");
		jQuery.each( galaxy.locations, function(key, value){
      var isKnown = player.isLocationKnown(value.id);
			if(!isKnown) return true; //continue; //skip over unknown location

			var node = new MapNode();
			//node.initializeWithJson(value);
			node.updateFromModel( value, true );
			node.setPos( node.origX - blockThis.scroll.x, node.origY - blockThis.scroll.y );
			blockThis.div.append( node.getDiv() );
			blockThis.nodes.push( node );


			var from = value.id;
			var fromLoc = value;
			jQuery.each(value.destinations, function(k, destId) {
				var toLoc = Service.get("galaxy").getLocation( destId );
				var to = toLoc.id;
				var fromTo = uniqueFromTo(from, to);

				blockThis.linkMap[ fromTo ] = { from:new Vec2D( fromLoc.coords.x, fromLoc.coords.y ), to:new Vec2D( toLoc.coords.x, toLoc.coords.y ) };
			});
		});

		//todo: create link dots
		jQuery.each(this.linkMap, function(key, value){
			//from value.x1, value.y1;
			//to value.x2, value.y2;

			//1) calc dist
			var dv = value.to.getVecSub( value.from );
			var distance = dv.getMag();
			//2) calc num dots
			var targetDistPerSeg = 35;
			var numSegs = Math.floor(distance / targetDistPerSeg);
			var numDots = numSegs - 1; //dont do dot at first or last end
			var distPerSegment = distance / numSegs;
			//3) create dots along path
			//3.1) unitize from->to vector
			dv = dv.getUnitized();
			//3.2) multiply (3.1) by dist/numDots;
			for( var idx = 1; idx < numDots; idx++ ) { //start at 1 to skip first dot
				//3.3) for(numDots: i ) create dot at from + (3.2) * i
				var pos = value.from.getVecAdd( dv.getScalarMult( idx * distPerSegment ) );
				var dot = new DotNode( pos.x, pos.y );
        dot.setPos( dot.origX - blockThis.scroll.x, dot.origY - blockThis.scroll.y );
				blockThis.div.append( dot.getDiv() );
				blockThis.dotNodes.push( dot );
			}

		});
	},
  setCurrentLocation: function( locModel ) {
    var blockThis = this;
    jQuery.each( this.nodes, function(key, value){
      if( value.updateTarget == locModel ) {
        value.setHighlighted(true);
        blockThis.scrollToNode( value, true );
        return false;
      }
    });
  },
  scrollToNode: function( node, animate ) {
    this.scrollMapTo(  (node.origX) - this.w_h  , (node.origY) - this.h_h, animate );
  },
	scrollMapBy: function( x, y, animate ) {
		this.scroll.x += x;
		this.scroll.y += y;

		this._updateAfterScroll();
	},
	scrollMapTo: function( x, y, animate ) {
		this.scroll.x = x;
		this.scroll.y = y;

		this._updateAfterScroll( animate );
	},
	_updateAfterScroll: function( animate ){
		var cx = this.w_h;
		var cy = this.h_h;

    var margin = 20;

		//update existing nodes
		var blockThis = this;
		jQuery.each( this.nodes.concat(this.dotNodes) , function(idx, value){
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
			if( x < margin ) x = margin;
			if( x >= blockThis.w - margin ) x = blockThis.w - margin;
			if( y < margin ) y = margin;
			if( y >= blockThis.h - margin ) y = blockThis.h - margin;
			value.setPos( x - value.w_h, y - value.h_h, animate );

			value.setScale( scale, animate );
		});


		this.lblName.text( "Universe (" + (this.scroll.x + this.w_h )+","+ (this.scroll.y+this.h_h)+")");
	},
	onNodeClicked: function(evt){
    this.scrollToNode( evt.node, true );
    //evt.node.setHighlighted(true);
	},
  onDiscoveredLocation: function(evt){
    //reload to render new location
    //TODO: optimize-- only add new MapNode and DotNodes

    var galaxy = Service.get("galaxy");
    this.initializeWithGalaxySim( galaxy );
  }
});
