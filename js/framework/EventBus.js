//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js


var EventBus = Class.create({
  initialize : function( strBusName ) {
    this.listeners = {};
		this.busName = strBusName;
		this.logToConsole = false;
  },
  g_eventBuses : {},
  addListener : function( strEventName, callbackFunction ) {
    if(! this.listeners[strEventName] )
    {
      this.listeners[strEventName] = [];
    }
    this.listeners[strEventName].push(callbackFunction);
  },
  removeListener : function( strEventName, callbackFunction ) {
    if(! this.listeners[strEventName] ) return; //nothing to remove

    var idx = this.listeners[strEventName].indexOf( callbackFunction );
    this.listeners[strEventName].splice( idx, 1 );
  },
  //note: expects evtObj.evtName to be the strEventName to send to
  dispatch : function( evtObj ) {
    if(!evtObj.evtName) { console.log("abort dispatch event -- no evtName %O", evtObj); return; }

		if(this.logToConsole) {
			console.log("EB["+this.busName+"] "+evtObj.evtName+":%O", evtObj);
		}

    if(!this.listeners[evtObj.evtName] ) return; //no one listening

    this.listeners[evtObj.evtName].forEach(function(ele, idx, arr){
      ele( evtObj ); //dispatch the event
    });
  }
});

//global accessor
EventBus.get = function( strBusName )
{
  if( !EventBus.prototype.g_eventBuses[strBusName] ) {
    EventBus.prototype.g_eventBuses[strBusName] = new EventBus( strBusName ); //create new
  }
  return EventBus.prototype.g_eventBuses[strBusName];
}

//default channels
EventBus.game = EventBus.get("game");
EventBus.ui = EventBus.get("ui");
