//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

ui:<successEvtName>: { dialog:this, text: someText }
ui:"DialogCancel": { dialog:this }

*/

var TextAreaDialog = Class.create({
	initialize: function( parentHtmlElement ) {
		this.parent = parentHtmlElement;
    this.cancelled = false;
	},
  initWithTitleAndText: function( title, text, succesEvtName ) {
    this.cancelled = false;
    var blockThis = this;

    var ta = jQuery("<textArea class='text ui-widget-content ui-corner-all' width='100%'>");
    ta.text(text);

    this.div = jQuery("<div>").append(ta);

    this.textArea = ta;

    jQuery(this.parentHtmlElement).append(this.div);

    this.div.dialog({
      modal: true,
      title:title,
      buttons: {
        Ok: function() {
					this.done = true;
          var text = blockThis.textArea.val();
          EventBus.ui.dispatch({evtName:succesEvtName, text:text });
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
