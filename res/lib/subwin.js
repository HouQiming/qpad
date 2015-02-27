var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

W.SubWindow=function(id,attrs){
	//just title bar + cross button
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "sub_window");
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		UI.Begin(UI.Keep("caption",W.RoundRect("-",{
				'x':0,'y':0,'w':obj.w,'h':obj.h_caption,
				'border_color':obj.border_color,'border_width':obj.border_width,
				'color':obj.caption_color})))
			//text
			W.Text("-",{
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
	UI.End(obj)
	return obj;
}
