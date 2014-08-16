//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js

var Vec2D = Class.create({
  initialize: function( x, y ){
		this.x = x;
		this.y = y;
	},
	initializeWithPos: function( posObj ) {
		this.x = posObj.x;
		this.y = posObj.y;
	},
	getUnitized: function() {
		var mag = this.getMag();
		return new Vec2D( this.x / mag, this.y / mag );
	},
	getMagSq: function() {
		return (this.x*this.x) + (this.y*this.y);
	},
	getMag: function() {
		return Math.sqrt((this.x*this.x) + (this.y*this.y));
	},
	getScalarMult: function( scalar ) {
		return new Vec2D( this.x * scalar, this.y * scalar );
	},
	getVecAdd: function( vec2 ) {
		return new Vec2D( this.x + vec2.x, this.y + vec2.y );
	},
	getVecSub: function( vec2 ) {
		return new Vec2D( this.x - vec2.x, this.y - vec2.y );
	}
});
