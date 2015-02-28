var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

///////////////////////
W.SubWindow=function(id,attrs){
	//just title bar + cross button
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "sub_window");
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		UI.Begin(UI.Keep("caption",W.RoundRect("",{
				'x':0,'y':0,'w':obj.w,'h':obj.h_caption,
				'border_color':obj.border_color,'border_width':obj.border_width,
				'color':obj.caption_color})))
			//text
			W.Text("",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"center",
				'x':obj.padding,'y':0,
				'font':obj.font,'text':obj.title,'color':obj.text_color,
			})
			//the closing button
			//×✕✖
			W.Button("hide",{
				'anchor':'parent','anchor_align':"right",'anchor_valign':"center",
				'x':0,'y':0,
				'style':obj.button_style,
				'text':'✕',
				'OnClick':function(){obj.is_hidden=1;UI.Refresh();}
			})
		UI.End()
		obj.body();
	UI.End()
	return obj;
}

///////////////////////
W.TabLabel_prototype={
	//todo: mouseover, dragging, click-sel, possible color animation
	//use style color rather than per-tab color for animation?
}
W.TabLabel=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabLabel_prototype);
	UI.StdStyling(id,obj,attrs, "tab_label",obj.selected?"active":"inactive");
	if(!attrs.w){
		obj.text=obj.title;
		obj.w=UI.MeasureIconText(obj).w;
	}
	UI.StdAnchoring(id,obj);
	UI.Begin(obj)
		if(obj.selected){
			UI.RoundRect({
				x:obj.x-obj.shadow_size,y:obj.y-obj.shadow_size,w:obj.w+obj.shadow_size*2,h:obj.h+obj.shadow_size*2,
				color:obj.shadow_color,border_width:-obj.shadow_size,round:obj.shadow_size,
			})
			UI.RoundRect({
				x:obj.x,y:obj.y,w:obj.w,h:obj.h,
				color:obj.color,
			})
		}
		W.Text("",{
			'anchor':'parent','anchor_align':"center",'anchor_valign':"center",
			'x':0,'y':0,
			'font':obj.font,'text':obj.title,'color':obj.text_color,
		})
	UI.End()
	return obj
}

var SearchByProperty=function(list,property,value){
	for(var i=0;i<list.length;i++){
		if(list[i][property]==value){return i;}
	}
	return -1;
};
W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	if((obj.n_tabs_last_checked||0)<obj.items.length){
		//new tab activating
		obj.current_tab_id=(obj.items[obj.items.length-1].id||"$"+(obj.items.length-1));
		obj.n_tabs_last_checked=obj.items.length;
	}
	UI.Begin(obj)
		var sel={}
		var tabid=(obj.current_tab_id||"$0");
		sel[tabid]=1
		W.Group("labels",{
			'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
			'layout_direction':'right','layout_spacing':0,'layout_align':'left','layout_valign':'fill',
			x:0,y:0,h:obj.h_caption,
			item_template:{object_type:W.TabLabel},
			items:obj.items,
			selection:sel,
		})
		obj.h_content=obj.h-(obj.h_caption+obj.h_bar);
		obj.active_tab=obj.labels[tabid]
		if(obj.active_tab){
			var tab=obj.active_tab;
			//theme-colored bar
			W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:obj.h_caption,h:obj.h_bar,
				color:tab.color})
			UI.Begin(UI.Keep(tabid,W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:obj.h_caption+obj.h_bar,h:obj.h_content,
				color:obj.color, border_width:obj.border_width, border_color:obj.border_color,
			})))
				//use body: object_type==undefined needed for TabLabel
				tab.body()
			UI.End()
		}
	UI.End()
	W.Hotkey("",{key:"CTRL+TAB",action:UI.HackCallback(function(){
		var num_id=SearchByProperty(obj.items,"id",tabid)
		if(num_id<0){return;}
		num_id++;if(num_id>=obj.items.length){num_id=0;}
		obj.current_tab_id=obj.items[num_id].id
		UI.Refresh()
	})});
	W.Hotkey("",{key:"CTRL+SHIFT+TAB",action:UI.HackCallback(function(){
		var num_id=SearchByProperty(obj.items,"id",tabid)
		if(num_id<0){return;}
		if(!num_id){num_id=obj.items.length;}
		num_id--;
		obj.current_tab_id=obj.items[num_id].id
		UI.Refresh()
	})});
	return obj
}
