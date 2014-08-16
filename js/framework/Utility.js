//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include js/framework/EventDispatcher

function getRand(min, max) {
  return ~~(Math.random() * (max - min + 1)) + min
}

//get dictionary length
function dicLength( dictionary ) {
	return Object.keys(dictionary).length;
}


function jQueryIcon( strName ) {
	return jQuery("<span class='ui-icon "+strName+"' style='display:inline-block'></span>");
}

//options must be [{ value:"returnValue", text:"userVisible" } ..]
// text is optional, if not found value will be used for userVisible text
// if optDefaultSelectValue is set, the option with the same value will be selected by default
function create_select_div( options, optDefaultSelectValue ) {
	var selectHtml = "<select>";
	jQuery.each(options, function(selIdx, selValue){
		var selText = selValue.value;
		if( selValue["text"] ) selText = selValue.text;
		selectHtml += "<option value='"+selValue.value+"'>"+selText+"</option>";
	});
	selectHtml += "</select>";
	var div = jQuery(selectHtml);
	if(optDefaultSelectValue) {
		console.log("select default value " + optDefaultSelectValue);
		div.find("option[value='"+optDefaultSelectValue+"']").prop('selected', true);
	}
	return div;
}

function show_text_dialog(parentHtmlElem, title, text, btnText, successEvtName ) {
  var div = jQuery("<div><p>"+text+"</p></div>");

  parentHtmlElem.append(div);

  div.dialog({
      modal: true,
      title:title,
      buttons: [
        { text:btnText,
          click: function() {
            jQuery(this).dialog("close");
          }
      }],
			close: function() {
					if( !this.done ) {
						EventBus.ui.dispatch({evtName:successEvtName});
					}
				}
    });

  return div;
}
