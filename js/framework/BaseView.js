//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format

var BaseView = Class.create({
	initialize: function(){
		this.div = null;
		this.updateTarget = null;
	},
	destroy: function() {
    //remove any listeners, destroy any children
    this.setUpdateTarget(null);
  },
	updateFromModel: function( model, setAsUpdateTarget ) {
		 if(setAsUpdateTarget) {
      this.setUpdateTarget( model );
    }

		this._updateFromModel( model );
	},
	_updateFromModel: function( model ) {
		console.log("TODO: override _updateFromModel in base class");
	},
  getDiv: function() {
    //note: be sure to append this div to something on the HTML view tree or this element wont be visible
    return this.div;
  },
	setUpdateTarget: function( target ) {

    if( this.updateTarget != null ) {
			this._detachTarget( this.updateTarget );
    }

    this.updateTarget = target;
    if(target == null) return;

		this._attachTarget( target );
  },
	_detachTarget: function( target ) {
		console.log("TODO: override _dettachTarget in base class");
		//EX: target.removeListener("updateEvtName", this.onUpdateFunction.bind(this) );
	},
	_attachTarget: function( target ) {
		console.log("TODO: override _attachTarget in base class");
		//EX: target.addListener("updateEvtName", this.onUpdateFunction.bind(this) );
	}
});
