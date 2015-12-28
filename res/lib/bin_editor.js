var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");

W.BinaryEditor_prototype={
	ResetWBytes:function(w_bytes){
		this.m_w_bytes=w_bytes;
		var addr_lastline=Math.floor(this.m_data.length/w_bytes)*w_bytes;
		var lg=0;
		while(addr_lastline>0){
			addr_lastline=Math.floor(addr_lastline/16);
			lg++;
		}
		this.m_lg_addr=lg;
		this.m_line_number_font=(this.m_lg_addr<=8?this.line_number_font:this.line_number_font_small);
		this.m_w_line_number_char=UI.GetCharacterAdvance(this.m_line_number_font,48);
		this.m_w_addr=Math.min(this.m_lg_addr,8)*this.m_w_line_number_char+16;
		var hc_linenumber=UI.GetCharacterHeight(this.m_line_number_font);
		this.m_h_addr=hc_linenumber+8;
	},
	AutoScroll:function(){
		var hc=UI.GetCharacterHeight(this.font);
		var n_lines_disp=Math.max((this.h-this.m_h_addr)/hc,1)|0;
		this.m_scroll=Math.min(Math.max(this.m_scroll,this.m_sel1-(n_lines_disp-1)*this.m_w_bytes),this.m_sel1)
		this.m_scroll=Math.max(Math.min(this.m_scroll,this.m_data.length+this.m_w_bytes-1-n_lines_disp*this.m_w_bytes),0);
		this.m_scroll=Math.floor(this.m_scroll/this.m_w_bytes)*this.m_w_bytes;
	},
	ValidateSelection:function(is_shift,validation_dir){
		this.m_sel1=Math.min(Math.max(0,this.m_sel1),this.m_data.length);
		var rg=UI.BIN_GetTypeAt(this,this.m_sel1);
		var sz=1<<(rg.tid&3);
		if(validation_dir<0){
			this.m_sel1=Math.floor((this.m_sel1-rg.ofs)/sz)*sz+rg.ofs;
		}else{
			this.m_sel1=Math.floor((this.m_sel1-rg.ofs+sz-1)/sz)*sz+rg.ofs;
		}
		if(!is_shift){this.m_sel0=this.m_sel1;}
		this.AutoScroll()
	},
	OnKeyDown:function(event){
		var is_shift=event.keymod&(UI.KMOD_LSHIFT|UI.KMOD_RSHIFT);
		var IsHotkey=UI.IsHotkey;
		var validation_dir=-1;
		if(0){
		}else if(IsHotkey(event,"UP SHIFT+UP")){
			this.m_sel1-=this.m_w_bytes;
		}else if(IsHotkey(event,"DOWN SHIFT+DOWN")){
			this.m_sel1+=this.m_w_bytes;
		}else if(IsHotkey(event,"PGUP SHIFT+PGUP")){
			var hc=UI.GetCharacterHeight(this.font);
			var n_lines_disp=Math.max((this.h-this.m_h_addr)/hc,1)|0;
			this.m_sel1-=this.m_w_bytes*n_lines_disp;
			this.m_scroll-=this.m_w_bytes*n_lines_disp;
		}else if(IsHotkey(event,"PGDN SHIFT+PGDN")){
			var hc=UI.GetCharacterHeight(this.font);
			var n_lines_disp=Math.max((this.h-this.m_h_addr)/hc,1)|0;
			this.m_sel1+=this.m_w_bytes*n_lines_disp;
			this.m_scroll+=this.m_w_bytes*n_lines_disp;
		}else if(IsHotkey(event,"LEFT SHIFT+LEFT")){
			this.m_sel1--;
		}else if(IsHotkey(event,"RIGHT SHIFT+RIGHT")){
			this.m_sel1++;
			validation_dir=1;
		}else if(IsHotkey(event,"HOME SHIFT+HOME")){
			this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes;
		}else if(IsHotkey(event,"END SHIFT+END")){
			this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes+this.m_w_bytes-1;
		}else if(IsHotkey(event,"CTRL+HOME SHIFT+CTRL+HOME")){
			this.m_sel1=0;
		}else if(IsHotkey(event,"CTRL+END SHIFT+CTRL+END")){
			this.m_sel1=this.m_data.length;
		}else{
			return;
		}
		this.ValidateSelection(is_shift,validation_dir);
		UI.Refresh()
	},
};

W.BinaryEditor=function(id,attrs){
	//an ESC-hidable view options panel
	//  manual width adjust, hscroll if it doesn't fit
	//  b8 b16 b32 for hex view
	//		could simply width-align all types, shrinking font when needed
	//		allow line overflow for misaligned stuff
	//  minimap color theme
	//  parsing script, region management
	//could do the main view in pure JS... minimap is a different story though
	//	the duktape f32/f64 <-> text code is more precise
	//	to-text doesn't have to be - we have a width budget anyway
	//any complicated edit could be performed in the parser script
	var obj=UI.StdWidget(id,attrs,"binary_editor",W.BinaryEditor_prototype);
	var w_digit=UI.GetCharacterAdvance(obj.font,48)
	var w_space1=w_digit*0.75;
	var w_space4=w_digit*0.25;
	var w_space8=w_digit*0.25;
	var mapX=function(daddr_x){
		return w_digit*2*(daddr_x+1)+w_space1*(daddr_x)+w_space4*(daddr_x>>2)+w_space8*(daddr_x>>3);
	};
	var XYFromCcnt=function(pos){
		var daddr=pos-obj.m_scroll;
		var daddr_y=(daddr/obj.m_w_bytes)|0;
		var daddr_x=daddr-daddr_y*obj.m_w_bytes;
		return {x:mapX(daddr_x)-w_digit*2,y:daddr_y};
	};
	UI.Begin(obj)
		if(!obj.m_data){
			//todo: m:\stock\qiming\debug\SZ002439_20150421.bin
			obj.m_data=UI.BIN_MapCopyOnWrite(obj.file_name)
			//todo: parse it
			obj.m_native_view=UI.BIN_CreateView([
				{color:0xff000000,ofs:0*32,size:32,tid:1},
				{color:0xff000000,ofs:1*32,size:32,tid:16+1},
				{color:0xff000000,ofs:2*32,size:32,tid:2},
				{color:0xff000000,ofs:3*32,size:32,tid:3},
				{color:0xff000000,ofs:4*32,size:32,tid:4},
				{color:0xff000000,ofs:5*32,size:32,tid:5},
				{color:0xff000000,ofs:6*32,size:32,tid:6},
				{color:0xff000000,ofs:7*32,size:32,tid:7},
				{color:0xff000000,ofs:8*32,size:32,tid:8},
				{color:0xff000000,ofs:9*32,size:32,tid:9},
				{color:0xff000000,ofs:10*32,size:32,tid:10},
				{color:0xff000000,ofs:11*32,size:32,tid:11},
				{color:0xff000000,ofs:13*32,size:32,tid:13},
				{color:0xff000000,ofs:14*32,size:32,tid:14},
				{color:0xff000000,ofs:15*32,size:32,tid:15},
				{color:0xff000000,ofs:16*32+4,size:32,tid:15},
				])
			obj.m_scroll=0;
			obj.m_sel0=0;
			obj.m_sel1=0;
			obj.ResetWBytes(32);
		}
		var hc=UI.GetCharacterHeight(obj.font);
		var n_lines_disp=Math.max((obj.h-obj.m_h_addr)/hc,1)|0;
		var lg=obj.m_lg_addr;
		var y_linenumber0;
		var hc_linenumber=UI.GetCharacterHeight(obj.m_line_number_font);
		if(lg<=8){
			y_linenumber0=obj.y+(hc-hc_linenumber)*0.5
		}else{
			y_linenumber0=obj.y+(hc*0.5)
		}
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h,color:obj.bgcolor})
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.m_w_addr-4,h:obj.h,color:obj.line_number_bgcolor})
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.m_h_addr,color:obj.line_number_bgcolor})
		for(var i=0;i<obj.m_w_bytes;i++){
			var addr_value=i;
			var x_linenumber=obj.x+obj.m_w_addr+mapX(i);
			for(var j=0;j<2;j++){
				var addr2=Math.floor(addr_value/16)
				var ch=addr_value-addr2*16;
				if(ch>=10){
					ch+=65-10;
				}else{
					ch+=48;
				}
				addr_value=addr2;
				x_linenumber-=obj.m_w_line_number_char;
				UI.DrawChar(obj.m_line_number_font,x_linenumber,obj.y+4,obj.line_number_color,ch);
			}
		}
		for(var i=0;i<n_lines_disp;i++){
			var x_linenumber=obj.x+obj.m_w_addr-8;
			var addr_value=obj.m_scroll+i*obj.m_w_bytes;
			for(var j=0;j<lg&&j<8;j++){
				var addr2=Math.floor(addr_value/16)
				var ch=addr_value-addr2*16;
				if(ch>=10){
					ch+=65-10;
				}else{
					ch+=48;
				}
				addr_value=addr2;
				x_linenumber-=obj.m_w_line_number_char;
				UI.DrawChar(obj.m_line_number_font,x_linenumber,y_linenumber0+i*hc+obj.m_h_addr,obj.line_number_color,ch);
			}
			if(lg>8){
				x_linenumber=obj.x+obj.m_w_addr-8;
				for(var j=0;j<8;j++){
					var addr2=Math.floor(addr_value/16)
					var ch=addr_value-addr2*16;
					if(ch>=10){
						ch+=65-10;
					}else{
						ch+=48;
					}
					addr_value=addr2;
					x_linenumber-=obj.m_w_line_number_char;
					UI.DrawChar(obj.m_line_number_font,x_linenumber,y_linenumber0+i*hc+8,obj.line_number_color,ch);
				}
			}
		}
		//draw selection
		if(obj.m_sel0!=obj.m_sel1){
			var xy0=XYFromCcnt(Math.min(obj.m_sel0,obj.m_sel1));
			var xy1=XYFromCcnt(Math.max(obj.m_sel0,obj.m_sel1));
			var x_right=mapX(obj.m_w_bytes-1);
			if(xy0.y<0){xy0.y=0;xy0.x=0;}
			if(xy1.y>n_lines_disp){xy1.y=n_lines_disp;xy1.x=x_right;}
			for(var i=xy0.y;i<=xy1.y;i++){
				var x0=(i==xy0.y?xy0.x:0);
				var x1=(i==xy1.y?xy1.x:x_right);
				UI.RoundRect({
					x:obj.x+obj.m_w_addr+x0,
					y:obj.y+obj.m_h_addr+i*hc,
					w:x1-x0,
					h:hc,
					color:obj.bgcolor_selection
				})
			}
		}
		UI.BIN_Render(obj.x+obj.m_w_addr,obj.y+obj.m_h_addr,obj.w,obj.h,obj,obj.m_scroll)
		///////////////
		//todo: text, minimap
		///////////////
		if(UI.HasFocus(obj)){
			var caret_xy=XYFromCcnt(obj.m_sel1);
			var x_caret=obj.x+obj.m_w_addr+caret_xy.x;
			var y_caret=obj.y+obj.m_h_addr+caret_xy.y*hc;
			UI.SetCaret(UI.context_window,
				x_caret*UI.pixels_per_unit,y_caret*UI.pixels_per_unit,
				obj.caret_width*UI.pixels_per_unit,hc*UI.pixels_per_unit,
				obj.caret_color,obj.caret_flicker);
		}
	UI.End()
	return W.PureRegion(id,obj);
}

UI.NewBinaryEditorTab=function(fname0){
	var file_name=fname0||("<New #"+(g_new_id++).toString()+">")
	//DetectRepository(file_name)
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:UI.RemovePath(file_name),
		tooltip:file_name,
		opening_callbacks:[],
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			};
			var body=W.BinaryEditor("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
				if(this.opening_callbacks.length){
					if(body.m_finished_loading){
						var cbs=this.opening_callbacks
						if(cbs){
							for(var i=0;i<cbs.length;i++){
								cbs[i].call(body.doc);
							}
						}
					}else{
						body.opening_callbacks=this.opening_callbacks
					}
					this.opening_callbacks=[]
				}
			}
			var doc=body.doc;
			body.title=UI.RemovePath(body.file_name)
			body.tooltip=body.file_name
			//todo
			this.need_save=0
			//if(doc&&(doc.saved_point||0)!=doc.ed.GetUndoQueueLength()){
			//	body.title=body.title+'*'
			//	this.need_save=1
			//}
			return body;
		},
		Save:function(){
			if(!this.main_widget){return;}
			if(this.main_widget.file_name&&this.main_widget.file_name.indexOf('<')>=0){
				this.SaveAs()
				return
			}
			this.main_widget.Save();
			var doc=this.main_widget.doc;
			//todo
			this.need_save=0
			//if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
			//	this.need_save=1
			//}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(["All File","*.*"],
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path+"/*":
					this.main_widget.file_name,
				"",1);
			if(!fn){return;}
			this.file_name=fn
			this.main_widget.file_name=fn
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
		color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};
